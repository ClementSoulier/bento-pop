/**
 * Les types d'éléments du catalogue mobile, côté back-office.
 *
 * Depuis la migration `20260915100000_item_types_and_cases.sql`, un item a un
 * **type** (ce qu'il est, où on le cherche) distinct de la **case** qui
 * l'accueille. Artiste et Créateur de contenu sont deux cases de type
 * Personne. Cf. `docs/UX-15-NOUVELLES-CATEGORIES.md`.
 *
 * Deux moitiés. Les fonctions pures d'abord, testées par
 * `catalogue-types.test.ts` : validation d'un type, doublons probables,
 * blocages d'un changement de type. Les accès à la base ensuite, qui prennent
 * leur client en paramètre pour être rejouées contre le Supabase local par
 * `scripts/check-catalogue-types.ts` : l'écran est derrière une
 * authentification, c'est la seule façon de les vérifier sans session.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CategoryKey, Database } from '@bento-pop/supabase-mobile/types';

export type MobileClient = SupabaseClient<Database>;

export type ItemStatus = 'draft' | 'pending' | 'validated' | 'rejected' | 'merged';

/** Les statuts tels que le back-office les écrit. */
export const STATUS_LABELS: Record<ItemStatus, string> = {
  validated: 'validé',
  pending: 'en attente',
  draft: 'brouillon',
  rejected: 'rejeté',
  merged: 'fusionné',
};

/** Un type, avec ce qu'en dit le catalogue. */
export type ItemTypeRow = {
  id: number;
  key: string;
  label: string;
  order: number;
  active: boolean;
  /** Intitulés des cases du bento principal qui portent ce type. */
  cases: string[];
  counts: { validated: number; pending: number; draft: number };
};

export type Result<T = undefined> = T extends undefined
  ? { ok: true } | { ok: false; error: string }
  : { ok: true; value: T } | { ok: false; error: string };

// ─── Validation d'un type ──────────────────────────────────────────────

/** Même règle que la contrainte `item_types.key` en base. */
export const TYPE_KEY_PATTERN = /^[a-z][a-z0-9_]{2,19}$/;
export const TYPE_LABEL_MAX = 40;

export type ItemTypeInput = { key: string; label: string; order: number };

/**
 * Valide la création d'un type avant d'écrire.
 *
 * La clé est définitive (D10 de la spec) : elle passe dans le code et dans les
 * URL. On la refuse donc tôt, avec un message lisible, plutôt que de laisser
 * la contrainte SQL répondre en anglais.
 */
export function validateItemTypeInput(input: ItemTypeInput): Result<ItemTypeInput> {
  const key = input.key.trim();
  const label = input.label.trim();
  if (!TYPE_KEY_PATTERN.test(key)) {
    return {
      ok: false,
      error: 'Clé : 3 à 20 caractères, minuscules, chiffres ou _, en commençant par une lettre.',
    };
  }
  if (label.length === 0) return { ok: false, error: 'Le libellé est obligatoire.' };
  if (label.length > TYPE_LABEL_MAX) {
    return { ok: false, error: `Libellé : ${TYPE_LABEL_MAX} caractères au plus.` };
  }
  if (!Number.isInteger(input.order) || input.order < 0 || input.order > 999) {
    return { ok: false, error: 'Ordre : un entier de 0 à 999.' };
  }
  return { ok: true, value: { key, label, order: input.order } };
}

/** « A », « A et B », « A, B et C ». */
function joinFr(words: readonly string[]): string {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} et ${words[words.length - 1]}`;
}

/**
 * Un type porté par une case du bento principal ne se désactive pas : la
 * recherche de cette case ne rendrait plus rien, dans toutes les versions de
 * l'app.
 */
export function deactivationBlocker(type: Pick<ItemTypeRow, 'cases'>): string | null {
  if (type.cases.length === 0) return null;
  return type.cases.length === 1
    ? `Porté par la case ${type.cases[0]} du bento principal : le désactiver viderait sa recherche.`
    : `Porté par les cases ${joinFr(type.cases)} du bento principal : le désactiver viderait leur recherche.`;
}

// ─── Doublons probables ────────────────────────────────────────────────

/**
 * Forme de comparaison d'un titre : sans accents, sans casse, sans
 * ponctuation. « Joueur du Grenier » et « joueur du grenier » se rejoignent.
 */
export function normalizeTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export type DuplicateCandidate = {
  id: string;
  title: string;
  typeId: number;
  status: ItemStatus;
  bentoCount: number;
  hasImage: boolean;
  createdAt: string;
};

export type DuplicateGroup = {
  typeId: number;
  normalized: string;
  /** L'item à garder, en tête ; les autres sont à fusionner dedans. */
  items: DuplicateCandidate[];
};

/** Rang d'un item pour être le canonique : validé, présent, illustré, ancien. */
function canonicalRank(a: DuplicateCandidate, b: DuplicateCandidate): number {
  const validated = Number(b.status === 'validated') - Number(a.status === 'validated');
  if (validated !== 0) return validated;
  if (b.bentoCount !== a.bentoCount) return b.bentoCount - a.bentoCount;
  const image = Number(b.hasImage) - Number(a.hasImage);
  if (image !== 0) return image;
  return a.createdAt.localeCompare(b.createdAt);
}

/**
 * Les items d'un même type qui portent le même titre, une fois normalisé.
 *
 * Les items fusionnés ou refusés sont écartés : ils ne sortent plus nulle
 * part. Le premier de chaque groupe est le canonique proposé.
 */
export function findDuplicateGroups(items: readonly DuplicateCandidate[]): DuplicateGroup[] {
  const groups = new Map<string, DuplicateCandidate[]>();
  for (const item of items) {
    if (item.status === 'merged' || item.status === 'rejected') continue;
    const normalized = normalizeTitle(item.title);
    if (normalized.length === 0) continue;
    const key = `${item.typeId}:${normalized}`;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([key, list]) => ({
      typeId: list[0]!.typeId,
      normalized: key.slice(key.indexOf(':') + 1),
      items: [...list].sort(canonicalRank),
    }))
    .sort((a, b) => a.normalized.localeCompare(b.normalized, 'fr'));
}

// ─── Changer le type d'un item ─────────────────────────────────────────

export type ItemUsage = { bentoId: string; caseKey: string; caseLabel: string; caseTypeId: number };

/**
 * Les cases qui empêchent de passer un item à un autre type.
 *
 * La base refuse qu'un item posé dans une case d'un autre type en change
 * (`items_check_type_change`). On le dit avant d'essayer, et on dit où. Une
 * fusion n'y change rien : elle ne réunit que des items du même type.
 */
export function retypeBlockers<T extends ItemUsage>(usage: readonly T[], newTypeId: number): T[] {
  return usage.filter((u) => u.caseTypeId !== newTypeId);
}

/** Traduit les refus de la base en phrases de back-office. */
export function explainTypeError(error: { code?: string; message: string }): string {
  if (error.code === '23514' && error.message.includes('posé dans une case')) {
    return 'Cet item est posé dans une case d’un autre type : retire-le de ces bentos avant de changer son type.';
  }
  if (error.code === '23514' && error.message.includes('pas du type de la case')) {
    return 'Cet item n’est pas du type de la case.';
  }
  if (error.code === '23505') return 'Cette clé de type existe déjà.';
  return error.message;
}

// ─── Accès à la base ───────────────────────────────────────────────────

/**
 * PostgREST plafonne une réponse à 1 000 lignes sur Supabase, sans erreur :
 * un `limit(10000)` rendrait 1 000 lignes et des compteurs faux le jour où le
 * catalogue dépasserait ce seuil. On lit donc par pages.
 */
const PAGE_SIZE = 1000;

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Lit toutes les lignes, page par page. La requête doit avoir un ordre stable. */
export async function readAll<T>(page: (from: number, to: number) => Page<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

/** Tous les types, actifs ou non, avec leurs cases et leurs compteurs. */
export async function loadItemTypes(client: MobileClient): Promise<ItemTypeRow[]> {
  const [{ data: types, error }, { data: cases }, items] = await Promise.all([
    client
      .from('item_types')
      .select('id, key, label_fr, display_order, is_active')
      .order('display_order'),
    client.from('bento_categories').select('label_fr, type_id').order('id'),
    readAll((from, to) =>
      client.from('items').select('type_id, status').order('id').range(from, to),
    ),
  ]);
  if (error) throw new Error(`Lecture des types échouée : ${error.message}`);

  return (types ?? []).map((t) => {
    const mine = items.filter((i) => i.type_id === t.id);
    return {
      id: t.id,
      key: t.key,
      label: t.label_fr,
      order: t.display_order,
      active: t.is_active,
      cases: (cases ?? []).filter((c) => c.type_id === t.id).map((c) => c.label_fr),
      counts: {
        validated: mine.filter((i) => i.status === 'validated').length,
        pending: mine.filter((i) => i.status === 'pending').length,
        draft: mine.filter((i) => i.status === 'draft').length,
      },
    };
  });
}

/** Crée un type, inactif par défaut : il n'apparaît dans l'app qu'une fois activé. */
export async function createItemType(
  client: MobileClient,
  input: ItemTypeInput,
): Promise<Result<number>> {
  const valid = validateItemTypeInput(input);
  if (!valid.ok) return valid;
  const { data, error } = await client
    .from('item_types')
    .insert({
      key: valid.value.key,
      label_fr: valid.value.label,
      display_order: valid.value.order,
      is_active: false,
    })
    .select('id')
    .single();
  if (error || !data)
    return { ok: false, error: explainTypeError(error ?? { message: 'inconnu' }) };
  return { ok: true, value: data.id };
}

/** Change le libellé ou l'ordre. La clé, définitive, n'est jamais modifiée. */
export async function updateItemType(
  client: MobileClient,
  id: number,
  input: { label: string; order: number },
): Promise<Result> {
  const label = input.label.trim();
  if (label.length === 0 || label.length > TYPE_LABEL_MAX) {
    return { ok: false, error: `Libellé : 1 à ${TYPE_LABEL_MAX} caractères.` };
  }
  if (!Number.isInteger(input.order) || input.order < 0 || input.order > 999) {
    return { ok: false, error: 'Ordre : un entier de 0 à 999.' };
  }
  const { error } = await client
    .from('item_types')
    .update({ label_fr: label, display_order: input.order })
    .eq('id', id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Active ou désactive un type, sauf un type porté par une case du bento principal. */
export async function setItemTypeActive(
  client: MobileClient,
  id: number,
  active: boolean,
): Promise<Result> {
  if (!active) {
    const { data: cases } = await client
      .from('bento_categories')
      .select('label_fr')
      .eq('type_id', id)
      .order('id');
    const blocker = deactivationBlocker({ cases: (cases ?? []).map((c) => c.label_fr) });
    if (blocker) return { ok: false, error: blocker };
  }
  const { error } = await client.from('item_types').update({ is_active: active }).eq('id', id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Où un item est posé, et le type de chaque case. */
export async function loadItemUsage(client: MobileClient, itemId: string): Promise<ItemUsage[]> {
  const [{ data: rows }, { data: cases }] = await Promise.all([
    client.from('bento_items').select('bento_id, category_id').eq('item_id', itemId),
    client.from('bento_categories').select('id, key, label_fr, type_id'),
  ]);
  const caseById = new Map((cases ?? []).map((c) => [c.id, c]));
  return (rows ?? []).flatMap((r) => {
    const c = caseById.get(r.category_id);
    return c
      ? [{ bentoId: r.bento_id, caseKey: c.key, caseLabel: c.label_fr, caseTypeId: c.type_id }]
      : [];
  });
}

/**
 * Passe un item à un autre type.
 *
 * La case d'origine est effacée : elle imposerait son type, puisque le
 * trigger `items_set_type_from_case` déduit le type de la case quand elle
 * est posée.
 */
export async function changeItemType(
  client: MobileClient,
  itemId: string,
  typeId: number,
): Promise<Result> {
  const blockers = retypeBlockers(await loadItemUsage(client, itemId), typeId);
  if (blockers.length > 0) {
    return {
      ok: false,
      error: `Posé dans ${blockers.length} case${blockers.length > 1 ? 's' : ''} d’un autre type : retire-le de ces bentos avant de changer son type.`,
    };
  }
  const { error } = await client
    .from('items')
    .update({ category_id: null, type_id: typeId })
    .eq('id', itemId);
  return error ? { ok: false, error: explainTypeError(error) } : { ok: true };
}

/**
 * Valide des brouillons en une fois.
 *
 * Seuls les brouillons passent : un item refusé ou fusionné ne revient pas
 * par cette porte. Le trigger de cycle de vie pose `validated_at`.
 */
export async function validateDrafts(
  client: MobileClient,
  itemIds: readonly string[],
  adminUserId: string,
): Promise<Result<number>> {
  if (itemIds.length === 0) return { ok: true, value: 0 };
  if (itemIds.length > 500) return { ok: false, error: 'Au plus 500 brouillons à la fois.' };
  const { data, error } = await client
    .from('items')
    .update({ status: 'validated', validated_by: adminUserId })
    .in('id', [...itemIds])
    .eq('status', 'draft')
    .select('id');
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: data?.length ?? 0 };
}

/**
 * Une case du bento principal qui porte ce type, pour les fonctions de
 * recherche qui prennent une clé de case. `null` pour un type sans case, un
 * livre par exemple : sa recherche par type naîtra avec le chantier 13.
 */
export async function caseKeyForType(
  client: MobileClient,
  typeId: number,
): Promise<CategoryKey | null> {
  const { data } = await client
    .from('bento_categories')
    .select('key')
    // ⚠️ `edition_id is null` : depuis le chantier 13, la table porte aussi
    // les cases des éditions. Sans ce filtre, la recherche d'un type pourrait
    // être paramétrée par une case d'édition, dont la clé ne vaut que pour
    // cette édition-là.
    .is('edition_id', null)
    .eq('type_id', typeId)
    .order('id')
    .limit(1)
    .maybeSingle();
  return (data?.key as CategoryKey | undefined) ?? null;
}

/** Les items d'un type qui partagent un titre, pour l'encart « Doublons probables ». */
export async function loadDuplicateGroups(client: MobileClient): Promise<DuplicateGroup[]> {
  const [items, usage] = await Promise.all([
    readAll((from, to) =>
      client
        .from('items')
        .select('id, title, type_id, status, image_url, created_at')
        .in('status', ['draft', 'pending', 'validated'])
        .order('id')
        .range(from, to),
    ),
    readAll((from, to) =>
      client
        .from('bento_items')
        .select('item_id')
        .order('bento_id')
        .order('category_id')
        .range(from, to),
    ),
  ]);
  const counts = new Map<string, number>();
  for (const row of usage) counts.set(row.item_id, (counts.get(row.item_id) ?? 0) + 1);
  return findDuplicateGroups(
    items.map((i) => ({
      id: i.id,
      title: i.title,
      typeId: i.type_id,
      status: i.status as ItemStatus,
      bentoCount: counts.get(i.id) ?? 0,
      hasImage: Boolean(i.image_url),
      createdAt: i.created_at,
    })),
  );
}
