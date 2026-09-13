import type { SupabaseClient } from '@supabase/supabase-js';
import { CATEGORY_BY_ID, CATEGORY_META } from '@bento-pop/supabase-mobile/bento';
import { cleanTitle } from './text';
import type { CategoryKey, Database } from '@/supabase/types';

/**
 * Couche de données de l'onglet « Trouver ».
 *
 * Cf. `docs/UX-06-TROUVER.md`. La règle qui tient tout le module tient en une
 * phrase : **on ne propose que ce qui mène quelque part.** Elle est appliquée
 * en SQL, pas ici, parce qu'un filtre client se contourne en oubliant de
 * l'appeler. Au 13 septembre 2026, 46 des 72 comptes de la production
 * n'avaient aucun bento publié et étaient pourtant tous proposés : deux tiers
 * des résultats de recherche menaient à « Bento introuvable ».
 *
 * **Le client est un paramètre, pas un import.** Même raison que dans
 * `feed.ts` et `suggestions.ts` : le singleton de `@/supabase/client` tire
 * `react-native-url-polyfill`, AsyncStorage et `expo-constants` au
 * chargement, ce qui rend inchargeable sous `node:test` tout module qui
 * l'importe.
 */

export type SearchClient = SupabaseClient<Database>;

/** Ligne brute renvoyée par la RPC `search_bentos`. */
export type SearchRow = Database['public']['Functions']['search_bentos']['Returns'][number];

/** Ligne brute renvoyée par la RPC `shared_items`. */
export type SharedItemRow = Database['public']['Functions']['shared_items']['Returns'][number];

export type SearchMatch = {
  bentoId: string;
  pseudo: string;
  displayName: string | null;
  isFeatured: boolean;
  /**
   * L'item qui a provoqué le résultat, `null` quand c'est le pseudo qui a
   * correspondu. C'est ce qui permet à la ligne d'afficher sa raison plutôt
   * que de laisser deviner pourquoi cette personne sort sur « inception ».
   */
  item: { id: string; title: string; category: CategoryKey } | null;
};

export type SearchResults = {
  /** Correspondances de pseudo. */
  accounts: SearchMatch[];
  /** Correspondances par le contenu de la boîte. */
  viaItems: SearchMatch[];
};

export type SharedItem = {
  id: string;
  title: string;
  category: CategoryKey;
  /** Nombre de bentos publiés contenant cet item. Toujours >= 2. */
  picks: number;
};

/**
 * Plancher de déclenchement de la recherche.
 *
 * Une lettre ne sépare rien : mesuré le 13 septembre 2026 sur la production,
 * « a » en sous-chaîne correspond à 94 des 137 items posés et 15 des
 * 26 comptes vivants. Deux caractères ramènent « an » à 30 items et
 * 4 comptes, ce qui redevient une recherche.
 */
export const MIN_QUERY_LENGTH = 2;

/**
 * Plafond de résultats, toutes sections confondues.
 *
 * Il n'y a que 26 bentos publiés : la limite ne mord pas aujourd'hui. Elle
 * existe pour que la page ne grandisse pas en silence avec le corpus.
 */
export const SEARCH_LIMIT = 20;

/** Douze suggestions, comme le bloc « Au menu » du chantier 3. */
export const SHARED_ITEMS_COUNT = 12;

/** `true` quand la chaîne saisie mérite un aller-retour réseau. */
export function isSearchable(query: string): boolean {
  return query.trim().length >= MIN_QUERY_LENGTH;
}

/**
 * Ligne PostgREST vers modèle de vue. Pure, donc testable sans réseau.
 *
 * Renvoie `null` quand la ligne ne peut pas produire un résultat exploitable,
 * c'est-à-dire quand `match_kind` porte une valeur inconnue. Le classer au
 * hasard dans l'une des deux sections serait pire que l'omettre : la ligne
 * dirait « voici pourquoi » en montrant une raison fausse.
 *
 * Une catégorie inconnue, elle, **n'écarte pas la ligne**. Une 7e catégorie
 * déployée en base avant les clients ne doit pas faire disparaître une
 * personne des résultats : le match perd sa mention d'item et bascule dans
 * les comptes, ce qui reste vrai et navigable.
 */
export function mapSearchRow(row: SearchRow): { match: SearchMatch; kind: 'pseudo' | 'item' } | null {
  if (row.match_kind !== 'pseudo' && row.match_kind !== 'item') return null;

  const base = {
    bentoId: row.bento_id,
    pseudo: row.pseudo,
    displayName: row.display_name,
    isFeatured: row.is_featured,
  };

  if (row.match_kind === 'pseudo') return { match: { ...base, item: null }, kind: 'pseudo' };

  const category = row.category_id === null ? undefined : CATEGORY_BY_ID[row.category_id];
  if (!category || row.item_id === null || row.item_title === null) {
    return { match: { ...base, item: null }, kind: 'pseudo' };
  }

  return {
    match: { ...base, item: { id: row.item_id, title: row.item_title, category } },
    kind: 'item',
  };
}

/**
 * Découpe les lignes en deux sections et retire les pseudos bloqués.
 *
 * **L'ordre du SQL est préservé** dans chaque section. Le client ne dispose
 * pas des critères de départage de la fonction et ne pourrait pas reproduire
 * son classement : retrier ici casserait la stabilité que le SQL garantit.
 *
 * Le filtre des bloqués reste côté client parce que `useBlocked` est un état
 * local `AsyncStorage`, jamais envoyé au serveur. Ce chantier ne change pas
 * cette décision.
 */
export function splitResults(
  rows: readonly SearchRow[],
  blocked: ReadonlySet<string>,
): SearchResults {
  const accounts: SearchMatch[] = [];
  const viaItems: SearchMatch[] = [];

  for (const row of rows) {
    const mapped = mapSearchRow(row);
    if (!mapped) continue;
    // `useBlocked` stocke les pseudos en minuscules, mais la comparaison est
    // faite ici plutôt que supposée là-bas : un bloqué qui réapparaît dans
    // les résultats est un défaut de modération, pas un défaut d'affichage.
    if (blocked.has(mapped.match.pseudo.toLowerCase())) continue;
    (mapped.kind === 'pseudo' ? accounts : viaItems).push(mapped.match);
  }

  return { accounts, viaItems };
}

/** `true` quand aucune des deux sections n'a de quoi se rendre. */
export function isEmpty(results: SearchResults): boolean {
  return results.accounts.length === 0 && results.viaItems.length === 0;
}

/**
 * Libellé lu par VoiceOver pour une ligne de résultat.
 *
 * Une correspondance par item annonce **sa raison**. Sans elle, deux lignes
 * consécutives sur « inception » s'énonceraient « Voir le bento de @ralgan »
 * puis « Voir le bento de @keremasan », sans que rien ne dise ce qu'ils ont
 * en commun, alors que c'est toute l'information que l'écran apporte.
 */
export function matchAccessibilityLabel(match: SearchMatch): string {
  const who = match.displayName ? `@${match.pseudo}, ${match.displayName}` : `@${match.pseudo}`;
  if (!match.item) return `Voir le bento de ${who}`;
  const label = CATEGORY_META[match.item.category].label.toLowerCase();
  return `Voir le bento de ${who}, qui a ${cleanTitle(match.item.title)} dans sa case ${label}`;
}

/** Libellé lu par VoiceOver pour une puce de suggestion. */
export function sharedItemAccessibilityLabel(item: SharedItem): string {
  return `Chercher ${cleanTitle(item.title)}, présent dans ${item.picks} bentos`;
}

/**
 * Lance une recherche.
 *
 * **La requête part telle quelle**, sans échappement client. Les jokers `ilike`
 * `%` et `_` sont échappés dans la fonction SQL, et 14 pseudos de la
 * production contiennent un `_` : un second échappement ici doublerait les
 * antislashs et ferait disparaître `dark_hifus` de ses propres résultats.
 *
 * **Lève au lieu de renvoyer une liste vide**, comme `loadSuggestions` : sinon
 * une panne réseau et une recherche sans résultat deviendraient
 * indiscernables, et l'écran afficherait « Rien pour xyz » pendant une panne.
 */
export async function searchBentos(
  client: SearchClient,
  query: string,
  options?: { limit?: number },
): Promise<SearchRow[]> {
  const { data, error } = await client.rpc('search_bentos', {
    q: query.trim(),
    lim: options?.limit ?? SEARCH_LIMIT,
  });

  if (error) throw new Error(`Search failed: ${error.message}`);

  return data ?? [];
}

/**
 * Charge les items présents dans au moins deux bentos publiés.
 *
 * Une ligne dont la catégorie est inconnue est écartée : contrairement à un
 * résultat de recherche, une puce sans catégorie n'a rien à sauver, et
 * l'écran n'a besoin ni de la compter ni de l'afficher.
 */
export async function loadSharedItems(
  client: SearchClient,
  limit?: number,
): Promise<SharedItem[]> {
  const { data, error } = await client.rpc('shared_items', {
    lim: limit ?? SHARED_ITEMS_COUNT,
  });

  if (error) throw new Error(`Shared items load failed: ${error.message}`);

  return (data ?? []).flatMap((row) => {
    const category = CATEGORY_BY_ID[row.category_id];
    if (!category) return [];
    return [{ id: row.id, title: row.title, category, picks: row.picks }];
  });
}
