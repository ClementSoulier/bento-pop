import type { SupabaseClient } from '@supabase/supabase-js';
import { withAbortTimeout } from './abort-timeout';
import { bentoRoute } from './bento-address';
import { cleanTitle } from './text';
import { isBlockedAccount, type BlockedAccounts } from './blocked-accounts';
import type { Database } from '@/supabase/types';

/**
 * « Ils ont les mêmes goûts » : les bentos qui partagent des items avec un
 * bento publié. Chantier 20, lot 2.
 *
 * La règle vit en SQL, dans `bento_matches` : un même item dans deux bentos
 * publiés de deux comptes, chaque item pesant `1 / n`, `n` les comptes qui
 * l'ont choisi, et seulement les comptes qui ne se sont pas retirés de la
 * recherche (D1 à D3, D6). Ce module ne fait que lire, vérifier et dire
 * pourquoi.
 *
 * **Le client est un paramètre, pas un import**, comme dans `search.ts` : le
 * singleton de `@/supabase/client` rend inchargeable sous `node:test` tout
 * module qui l'importe.
 */

export type MatchesClient = SupabaseClient<Database>;

export type MatchItem = { id: string; title: string; categoryId: number | null };

export type BentoMatch = {
  bentoId: string;
  slug: string;
  isPrimary: boolean;
  /** Le compte du bento, pour le blocage par compte (chantier 21, D8). */
  userId: string | null;
  pseudo: string;
  displayName: string | null;
  /** Son Popy choisi, ou `null` pour celui du pseudo (chantier 21, D7). */
  avatar: string | null;
  /** Le titre de l'édition, pour un bento d'édition. */
  editionTitle: string | null;
  /** Le nombre d'items communs. */
  shared: number;
  score: number;
  /** Les items communs, du plus rare au plus commun. */
  items: MatchItem[];
};

export const BENTO_MATCHES_QUERY_ROOT = 'bento-matches';

/** Au plus 20 bentos (D11) : le plus fourni en avait 9 au 23 octobre 2026. */
export const BENTO_MATCHES_LIMIT = 20;

/** 5 s, comme le compteur de visites : au-delà, la pastille ne s'affiche pas. */
export const BENTO_MATCHES_TIMEOUT_MS = 5000;

/** Les matchs valent 5 minutes : ils ne bougent qu'à la publication d'un bento. */
export const BENTO_MATCHES_STALE_MS = 5 * 60 * 1000;

/** Trois items nommés au plus, les plus rares d'abord (D11). */
export const MATCH_REASON_ITEMS = 3;

export function bentoMatchesQueryKey(bentoId: string) {
  return [BENTO_MATCHES_QUERY_ROOT, bentoId] as const;
}

const nonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';

function parseItem(raw: unknown): MatchItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!nonEmpty(r.id) || !nonEmpty(r.title)) return null;
  const title = cleanTitle(r.title);
  if (!title) return null;
  return {
    id: r.id,
    title,
    categoryId: typeof r.category_id === 'number' ? r.category_id : null,
  };
}

/**
 * Une ligne de `bento_matches`, vérifiée, ou `null`. Un match sans item
 * lisible est écarté : il ne saurait pas dire pourquoi.
 */
export function parseMatchRow(raw: unknown): BentoMatch | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!nonEmpty(r.bento_id) || !nonEmpty(r.slug) || !nonEmpty(r.pseudo)) return null;
  const items = Array.isArray(r.items)
    ? r.items.map(parseItem).filter((item): item is MatchItem => item !== null)
    : [];
  if (items.length === 0) return null;
  return {
    bentoId: r.bento_id,
    slug: r.slug,
    isPrimary: r.is_primary === true,
    userId: nonEmpty(r.user_id) ? r.user_id : null,
    pseudo: r.pseudo,
    displayName: nonEmpty(r.display_name) ? r.display_name.trim() : null,
    avatar: nonEmpty(r.avatar) ? r.avatar : null,
    editionTitle: nonEmpty(r.edition_title) ? r.edition_title.trim() : null,
    shared: typeof r.shared === 'number' && r.shared >= items.length ? r.shared : items.length,
    score: typeof r.score === 'number' && Number.isFinite(r.score) ? r.score : 0,
    items,
  };
}

/**
 * Charge les matchs d'un bento. Lève sur une erreur, comme `searchBentos` :
 * l'écran distingue ainsi une panne d'un bento sans match.
 */
export async function loadMatches(
  client: MatchesClient,
  bentoId: string,
  signal?: AbortSignal,
): Promise<BentoMatch[]> {
  let request = client.rpc('bento_matches', { p_bento: bentoId, lim: BENTO_MATCHES_LIMIT });
  if (signal) request = request.abortSignal(signal);
  const { data, error } = await request;
  if (error) throw new Error(`Matches load failed: ${error.message}`);
  return (data ?? []).flatMap((row) => parseMatchRow(row) ?? []);
}

/**
 * Options de `useQuery`, partagées par la pastille et l'écran : la même clé,
 * donc une seule requête. Rien ne se réessaie, la pastille n'apparaît
 * simplement pas. `enabled` reste à l'écran, qui seul sait si la page a
 * trouvé son bento. Le délai est un paramètre pour les tests.
 */
export function bentoMatchesQueryOptions(
  client: MatchesClient,
  bentoId: string,
  timeoutMs: number = BENTO_MATCHES_TIMEOUT_MS,
) {
  return {
    queryKey: bentoMatchesQueryKey(bentoId),
    queryFn: ({ signal }: { signal: AbortSignal }): Promise<BentoMatch[]> =>
      withAbortTimeout((attempt) => loadMatches(client, bentoId, attempt), timeoutMs, signal),
    staleTime: BENTO_MATCHES_STALE_MS,
    retry: false,
  };
}

/**
 * Sans les comptes bloqués sur cet appareil (D13), comme le fil : la liste est
 * locale, la base ne la connaît pas.
 */
export function withoutBlocked(
  matches: readonly BentoMatch[],
  blocked: BlockedAccounts,
): BentoMatch[] {
  return matches.filter((match) => !isBlockedAccount(blocked, match));
}

/** L'adresse du bento d'un match, celle de « Trouver » et du fil. */
export function matchRoute(match: BentoMatch) {
  return bentoRoute(match.pseudo, match.slug, match.isPrimary);
}

/** « Dune », « Dune et Arcane », « Dune, Arcane et Severance ». */
function joinTitles(titles: readonly string[]): string {
  if (titles.length <= 1) return titles[0] ?? '';
  return `${titles.slice(0, -1).join(', ')} et ${titles[titles.length - 1]}`;
}

/**
 * Ce qu'ils ont en commun, les plus rares d'abord, trois au plus (D11) :
 * « Dune et Arcane en commun », « Dune, Arcane, Severance et 2 autres en
 * commun ».
 */
export function matchReasonLabel(match: Pick<BentoMatch, 'items' | 'shared'>): string {
  const named = match.items.slice(0, MATCH_REASON_ITEMS).map((item) => item.title);
  const others = Math.max(match.shared, match.items.length) - named.length;
  if (others <= 0) return `${joinTitles(named)} en commun`;
  return `${named.join(', ')} et ${others} ${others > 1 ? 'autres' : 'autre'} en commun`;
}

/**
 * Le libellé d'une ligne, d'un seul élément (§5.3) : « Bento de @alice : 2
 * items en commun, Dune et Arcane. » Tous les items, pas seulement les trois
 * affichés : la largeur de la ligne ne limite pas VoiceOver.
 */
export function matchAccessibilityLabel(match: BentoMatch): string {
  const whose = match.editionTitle
    ? `Bento « ${match.editionTitle} » de @${match.pseudo}`
    : `Bento de @${match.pseudo}`;
  const count = Math.max(match.shared, match.items.length);
  const titles = joinTitles(match.items.map((item) => item.title));
  return `${whose} : ${count} ${count > 1 ? 'items' : 'item'} en commun, ${titles}.`;
}

/** Le texte de la pastille (D10) : « Mêmes goûts · 3 ». */
export function matchesPillLabel(count: number): string {
  return `Mêmes goûts · ${count}`;
}

/**
 * Son libellé accessible : « 3 bentos ont les mêmes goûts que toi », sur son
 * propre bento (D12), « que celui-ci » sinon.
 */
export function matchesPillAccessibilityLabel(count: number, isOwn: boolean): string {
  const who = count > 1 ? `${count} bentos ont` : '1 bento a';
  return `${who} les mêmes goûts que ${isOwn ? 'toi' : 'celui-ci'}`;
}
