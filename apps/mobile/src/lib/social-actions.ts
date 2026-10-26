import type { SupabaseClient } from '@supabase/supabase-js';
import type { BentoCommentRow, Database, ReportReason, ReportTargetKind } from '@/supabase/types';
import { cleanComment, toBentoSocial, type BentoSocial } from './social';

/**
 * Les appels du chantier 22 : les nombres, le cœur, les commentaires, le
 * signalement et le blocage. Tous passent par les fonctions de la base, seul
 * chemin des clients vers ces tables (§6.1).
 *
 * Le client est passé en argument, comme dans `account-actions.ts`, pour être
 * testé contre un bouchon. Chaque appel lève une `Error` dont le message est
 * la clé de la base (`comment_needs_bento`, …), que `socialErrorMessage`
 * traduit ; une erreur réseau garde le sien.
 */

export type SocialClient = SupabaseClient<Database>;

/** `bento_social` lit 100 bentos au plus par appel. */
export const SOCIAL_BATCH = 100;

/** Une page de commentaires. */
export const COMMENTS_PAGE = 50;

function fail(error: { message: string } | null | undefined): never {
  throw new Error(error?.message ?? 'unknown');
}

/** Les nombres d'une série de bentos, par paquets de 100 (D16). */
export async function fetchBentoSocial(
  client: SocialClient,
  bentoIds: readonly string[],
): Promise<Map<string, BentoSocial>> {
  const result = new Map<string, BentoSocial>();
  const ids = [...new Set(bentoIds)];
  for (let i = 0; i < ids.length; i += SOCIAL_BATCH) {
    const { data, error } = await client.rpc('bento_social', { p_bentos: ids.slice(i, i + SOCIAL_BATCH) });
    if (error) fail(error);
    for (const row of data ?? []) result.set(row.bento_id, toBentoSocial(row));
  }
  return result;
}

/** Aimer ou ne plus aimer ; rend le nombre et l'état tels que la base les tient. */
export async function setLike(
  client: SocialClient,
  bentoId: string,
  liked: boolean,
): Promise<{ likes: number; liked: boolean }> {
  const { data, error } = await client.rpc('set_like', { p_bento: bentoId, p_liked: liked });
  if (error) fail(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) fail({ message: 'unknown' });
  return { likes: row.likes, liked: row.liked };
}

/**
 * Une page de commentaires, dans l'ordre où ils ont été écrits. La base rend
 * les plus récents d'abord, avant `before` ; la page se remet à l'endroit.
 */
export async function fetchComments(
  client: SocialClient,
  bentoId: string,
  before: string | null = null,
): Promise<BentoCommentRow[]> {
  const { data, error } = await client.rpc('list_bento_comments', {
    p_bento: bentoId,
    p_before: before,
    p_limit: COMMENTS_PAGE,
  });
  if (error) fail(error);
  return [...(data ?? [])].reverse();
}

export async function postComment(client: SocialClient, bentoId: string, body: string): Promise<BentoCommentRow> {
  const { data, error } = await client.rpc('post_comment', { p_bento: bentoId, p_body: cleanComment(body) });
  if (error) fail(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) fail({ message: 'unknown' });
  return row;
}

/** Rend `false` quand la base n'a rien supprimé : ni le sien, ni sur son bento. */
export async function deleteComment(client: SocialClient, commentId: string): Promise<boolean> {
  const { data, error } = await client.rpc('delete_comment', { p_comment: commentId });
  if (error) fail(error);
  return data === true;
}

export async function submitReport(
  client: SocialClient,
  input: { kind: ReportTargetKind; targetId: string; reason: ReportReason; details?: string | null },
): Promise<string> {
  const { data, error } = await client.rpc('submit_report', {
    p_target_kind: input.kind,
    p_target: input.targetId,
    p_reason: input.reason,
    p_details: input.details?.trim() ? input.details.trim() : null,
  });
  if (error) fail(error);
  return data as string;
}

export async function setBlock(client: SocialClient, userId: string, on: boolean): Promise<void> {
  const { error } = await client.rpc('set_block', { p_blocked: userId, p_on: on });
  if (error) fail(error);
}

/**
 * Verse une liste de comptes bloqués (vide pour ne rien verser) et rend celle
 * de la base, avec les pseudos du moment (D9).
 */
export async function syncBlocks(
  client: SocialClient,
  userIds: readonly string[],
): Promise<Array<{ blocked_id: string; pseudo: string | null }>> {
  const { data, error } = await client.rpc('sync_blocks', { p_blocked: [...userIds] });
  if (error) fail(error);
  return data ?? [];
}

/** Ses commentaires, ses likes et ses blocages, pour l'export (D21). */
export async function fetchSocialExport(client: SocialClient) {
  const { data, error } = await client.rpc('my_social_export');
  if (error) fail(error);
  return data;
}

/** « Accepter les commentaires » et « Afficher les j'aime » (D14). */
export async function writeSocialSetting(
  client: SocialClient,
  userId: string,
  setting: 'accept_comments' | 'accept_likes',
  on: boolean,
): Promise<void> {
  const patch = setting === 'accept_comments' ? { accept_comments: on } : { accept_likes: on };
  const { error } = await client.from('users').update(patch).eq('id', userId);
  if (error) fail(error);
}
