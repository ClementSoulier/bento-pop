import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, FollowListKind, FollowListRow, FollowStatus } from '@/supabase/types';
import { FOLLOW_PAGE, toFollowSummary, type FollowCursor, type FollowSummary } from './follows';

/**
 * Les appels du chantier 23 : suivre, répondre à une demande, retirer un
 * abonné, lire les nombres et les listes. Tous passent par les fonctions de
 * la base, seul chemin des clients (§6.2) ; le fil des abonnements vit avec
 * celui de « La table », `feed.ts`.
 *
 * Le client est passé en argument, comme dans `social-actions.ts`, pour être
 * testé contre un bouchon. Chaque appel lève une `Error` dont le message est
 * la clé de la base (`follow_blocked`, …), que `followErrorMessage` traduit.
 */

export type FollowClient = SupabaseClient<Database>;

/** Racine des clés React Query des nombres, pour les invalider d'un coup. */
export const FOLLOW_SUMMARY_ROOT = 'follow-summary';

/** Les nombres d'un compte dépendent aussi de qui les lit (D9) : sa clé le porte. */
export const followSummaryKey = (userId: string, viewerId: string | null) =>
  [FOLLOW_SUMMARY_ROOT, userId, viewerId] as const;

/** Racine des listes, invalidées après chaque geste. */
export const FOLLOW_LIST_ROOT = 'follow-list';

export const followListKey = (userId: string, kind: FollowListKind, viewerId: string | null) =>
  [FOLLOW_LIST_ROOT, userId, kind, viewerId] as const;

function fail(error: { message: string } | null | undefined): never {
  throw new Error(error?.message ?? 'unknown');
}

/** Suit ou ne suit plus. Rend l'état gardé par la base, `null` quand on ne suit plus. */
export async function setFollow(
  client: FollowClient,
  userId: string,
  on: boolean,
): Promise<FollowStatus | null> {
  const { data, error } = await client.rpc('set_follow', { p_user: userId, p_on: on });
  if (error) fail(error);
  return data ?? null;
}

/** Accepte ou refuse une demande reçue. Faux quand il n'y avait plus de demande. */
export async function answerFollow(
  client: FollowClient,
  followerId: string,
  accept: boolean,
): Promise<boolean> {
  const { data, error } = await client.rpc('answer_follow', { p_follower: followerId, p_accept: accept });
  if (error) fail(error);
  return data === true;
}

/** Retire un abonné, ou sa demande. */
export async function removeFollower(client: FollowClient, followerId: string): Promise<boolean> {
  const { data, error } = await client.rpc('remove_follower', { p_follower: followerId });
  if (error) fail(error);
  return data === true;
}

/** Les nombres d'un compte ; `null` quand l'interrupteur est éteint ou le compte inconnu. */
export async function fetchFollowSummary(
  client: FollowClient,
  userId: string,
): Promise<FollowSummary | null> {
  const { data, error } = await client.rpc('follow_summary', { p_user: userId });
  if (error) fail(error);
  const row = Array.isArray(data) ? data[0] : data;
  return row ? toFollowSummary(row) : null;
}

/**
 * « Valider mes abonnés » (D3, D11). La règle `users_update_own` ne laisse
 * écrire que sa propre ligne ; l'éteindre fait accepter par la base les
 * demandes en attente.
 */
export async function writeFollowApproval(client: FollowClient, userId: string, on: boolean): Promise<void> {
  const { error } = await client.from('users').update({ follow_approval: on }).eq('id', userId);
  if (error) throw error;
}

/** Une page d'une liste, 50 lignes au plus, après le curseur. */
export async function fetchFollowList(
  client: FollowClient,
  userId: string,
  kind: FollowListKind,
  cursor?: FollowCursor | null,
): Promise<FollowListRow[]> {
  const { data, error } = await client.rpc('follow_list', {
    p_user: userId,
    p_kind: kind,
    p_before: cursor?.before ?? null,
    p_before_id: cursor?.beforeId ?? null,
    p_limit: FOLLOW_PAGE,
  });
  if (error) fail(error);
  return data ?? [];
}
