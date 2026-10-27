import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, NotificationRow } from '@/supabase/types';
import { NOTIFICATION_PAGE, type NotificationCursor } from './notifications';

/**
 * Les appels du chantier 24 : le nombre de la pastille, la zone page par
 * page, et la date de lecture. Tous passent par les fonctions de la base,
 * qui ne rendent que la zone de qui appelle (§6.2).
 *
 * Le client est passé en argument, comme dans `follow-actions.ts`, pour être
 * testé contre un bouchon. Chaque appel lève une `Error` portant le message
 * de la base.
 */

export type NotificationClient = SupabaseClient<Database>;

/** Racine des clés React Query de la zone, pour l'invalider d'un coup. */
export const NOTIFICATIONS_ROOT = 'notifications';

export const notificationBadgeKey = (viewerId: string | null) =>
  [NOTIFICATIONS_ROOT, 'badge', viewerId] as const;

export const notificationListKey = (viewerId: string | null) =>
  [NOTIFICATIONS_ROOT, 'list', viewerId] as const;

function fail(error: { message: string } | null | undefined): never {
  throw new Error(error?.message ?? 'unknown');
}

/** Le nombre de lignes nouvelles (D8) ; 0 sans profil ou interrupteur éteint. */
export async function fetchNotificationBadge(client: NotificationClient): Promise<number> {
  const { data, error } = await client.rpc('notification_badge');
  if (error) fail(error);
  return typeof data === 'number' && data > 0 ? data : 0;
}

/** Une page de la zone, les plus récentes d'abord (D22). */
export async function fetchNotifications(
  client: NotificationClient,
  cursor: NotificationCursor,
): Promise<NotificationRow[]> {
  const { data, error } = await client.rpc('list_notifications', {
    p_before: cursor?.before ?? null,
    p_before_key: cursor?.beforeKey ?? null,
    p_limit: NOTIFICATION_PAGE,
  });
  if (error) fail(error);
  return data ?? [];
}

/** Pose la date de lecture (D8). Rend la date posée, `null` sans profil. */
export async function markNotificationsSeen(client: NotificationClient, until: string): Promise<string | null> {
  const { data, error } = await client.rpc('mark_notifications_seen', { p_until: until });
  if (error) fail(error);
  return data ?? null;
}
