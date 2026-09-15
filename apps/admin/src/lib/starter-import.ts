/**
 * Import des listes de départ en brouillons, depuis l'écran Types.
 *
 * Les candidats arrivent en `external_source = 'admin'` : c'est la seule
 * source, avec `user`, dont le trigger `items_set_status_on_insert` respecte le
 * statut. Toute autre source y est validée d'office, héritage des imports
 * d'API ; un brouillon deviendrait cherchable sans relecture.
 *
 * Un import relancé ne crée rien de plus, par deux verrous :
 *  - chaque candidat porte un `external_id` en `starter:<type>:<titre>`, que la
 *    contrainte `unique (external_source, external_id)` rend unique en base,
 *    même si deux imports partent en même temps ;
 *  - un candidat dont le titre existe déjà dans le type, en titre ou en alias
 *    et quel que soit son statut, n'est pas importé : l'équipe l'a déjà saisi,
 *    validé, refusé ou fusionné.
 *
 * Cf. `docs/UX-15-NOUVELLES-CATEGORIES.md`, lot 2.
 */
import { normalizeTitle, readAll, type MobileClient, type Result } from './catalogue-types';
import {
  STARTER_LISTS,
  STARTER_TYPE_KEYS,
  type StarterCandidate,
  type StarterTypeKey,
} from './starter-lists';

/** Préfixe des identifiants posés par l'import, et par lui seul. */
export const STARTER_ID_PREFIX = 'starter:';

/** `starter:book:le-petit-prince`, stable tant que le titre de la liste ne change pas. */
export function starterExternalId(typeKey: string, title: string): string {
  return `${STARTER_ID_PREFIX}${typeKey}:${normalizeTitle(title).replace(/ /g, '-')}`;
}

/** Un item venu d'une liste de départ, reconnu à son identifiant. */
export function isStarterItem(externalId: string | null): boolean {
  return externalId?.startsWith(STARTER_ID_PREFIX) ?? false;
}

export type ExistingItem = {
  title: string;
  externalId: string | null;
};

export type StarterPlan = {
  toInsert: StarterCandidate[];
  alreadyThere: StarterCandidate[];
};

/**
 * Ce qu'un import ajouterait au catalogue d'un type.
 *
 * `existing` et `aliases` sont les items de ce type et leurs alias, tous
 * statuts confondus. Un doublon à l'intérieur de la liste ne compte qu'une
 * fois.
 */
export function planStarterImport(
  typeKey: string,
  candidates: readonly StarterCandidate[],
  existing: readonly ExistingItem[],
  aliases: readonly string[] = [],
): StarterPlan {
  const titles = new Set([...existing.map((e) => normalizeTitle(e.title)), ...aliases.map(normalizeTitle)]);
  const ids = new Set(existing.map((e) => e.externalId).filter(isStarterItem));
  const seen = new Set<string>();
  const plan: StarterPlan = { toInsert: [], alreadyThere: [] };
  for (const candidate of candidates) {
    const normalized = normalizeTitle(candidate.title);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    if (titles.has(normalized) || ids.has(starterExternalId(typeKey, candidate.title))) {
      plan.alreadyThere.push(candidate);
    } else {
      plan.toInsert.push(candidate);
    }
  }
  return plan;
}

// ─── Accès à la base ───────────────────────────────────────────────────

export type StarterStatus = {
  typeKey: StarterTypeKey;
  typeLabel: string;
  candidates: number;
  alreadyThere: number;
  toInsert: number;
};

/** Les items d'un type et leurs alias, pour savoir ce qui y est déjà. */
async function loadTypeCatalogue(
  client: MobileClient,
  typeId: number,
): Promise<{ existing: ExistingItem[]; aliases: string[] }> {
  const [items, aliases] = await Promise.all([
    readAll((from, to) =>
      client
        .from('items')
        .select('title, external_id')
        .eq('type_id', typeId)
        .order('id')
        .range(from, to),
    ),
    // La jointure évite une liste d'identifiants dans l'URL, qui grandirait
    // avec le catalogue du type.
    readAll((from, to) =>
      client
        .from('item_aliases')
        .select('alias, items!inner(type_id)')
        .eq('items.type_id', typeId)
        .order('id')
        .range(from, to),
    ),
  ]);
  return {
    existing: items.map((i) => ({ title: i.title, externalId: i.external_id })),
    aliases: aliases.map((a) => a.alias),
  };
}

/** Pour chaque liste : combien de candidats, combien déjà là, combien à importer. */
export async function loadStarterStatuses(client: MobileClient): Promise<StarterStatus[]> {
  const { data: types, error } = await client
    .from('item_types')
    .select('id, key, label_fr')
    .in('key', [...STARTER_TYPE_KEYS]);
  if (error) throw new Error(`Lecture des types échouée : ${error.message}`);

  const statuses = await Promise.all(
    STARTER_TYPE_KEYS.map(async (typeKey): Promise<StarterStatus | null> => {
      const type = (types ?? []).find((t) => t.key === typeKey);
      if (!type) return null;
      const { existing, aliases } = await loadTypeCatalogue(client, type.id);
      const plan = planStarterImport(typeKey, STARTER_LISTS[typeKey], existing, aliases);
      return {
        typeKey,
        typeLabel: type.label_fr,
        candidates: plan.toInsert.length + plan.alreadyThere.length,
        alreadyThere: plan.alreadyThere.length,
        toInsert: plan.toInsert.length,
      };
    }),
  );
  return statuses.filter((s): s is StarterStatus => s !== null);
}

/**
 * Importe en brouillons les candidats d'une liste qui ne sont pas encore au
 * catalogue du type. Sans case d'origine : un brouillon du back-office n'en a
 * pas, et le type n'a pas de case dans le bento principal.
 */
export async function importStarterList(
  client: MobileClient,
  typeKey: StarterTypeKey,
): Promise<Result<{ inserted: number; alreadyThere: number }>> {
  const { data: type } = await client
    .from('item_types')
    .select('id')
    .eq('key', typeKey)
    .maybeSingle();
  if (!type) return { ok: false, error: `Le type ${typeKey} n'existe pas.` };

  const candidates = STARTER_LISTS[typeKey];
  const { existing, aliases } = await loadTypeCatalogue(client, type.id);
  const plan = planStarterImport(typeKey, candidates, existing, aliases);
  if (plan.toInsert.length === 0) {
    return { ok: true, value: { inserted: 0, alreadyThere: plan.alreadyThere.length } };
  }

  const { data, error } = await client
    .from('items')
    .upsert(
      plan.toInsert.map((c) => ({
        type_id: type.id,
        category_id: null,
        external_source: 'admin' as const,
        external_id: starterExternalId(typeKey, c.title),
        status: 'draft' as const,
        title: c.title,
        subtitle: c.subtitle ?? null,
      })),
      { onConflict: 'external_source,external_id', ignoreDuplicates: true },
    )
    .select('id');
  if (error) return { ok: false, error: error.message };

  const inserted = data?.length ?? 0;
  return {
    ok: true,
    value: { inserted, alreadyThere: plan.alreadyThere.length + plan.toInsert.length - inserted },
  };
}
