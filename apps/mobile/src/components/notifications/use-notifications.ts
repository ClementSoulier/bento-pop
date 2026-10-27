import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useViewer } from '@/components/follows/use-follows';
import {
  NOTIFICATIONS_ROOT,
  fetchNotificationBadge,
  fetchNotifications,
  notificationBadgeKey,
  notificationListKey,
} from '@/lib/notification-actions';
import { notificationCursor, type NotificationCursor } from '@/lib/notifications';
import { useAppStatus } from '@/state/app-status';
import { supabase } from '@/supabase/client';

/**
 * Les crochets du chantier 24 : l'interrupteur, le nombre de la pastille et
 * la zone. Rien en temps réel (D9) : le nombre se relit à l'ouverture, au
 * retour au premier plan et à chaque changement d'onglet, la zone à chaque
 * arrivée sur son onglet.
 */

/** Un nombre plus récent que cela ne se relit pas à un changement d'onglet. */
export const BADGE_STALE_MS = 15_000;

/** L'interrupteur (D13), allumé tant que la configuration n'a pas répondu. */
export function useNotificationsEnabled(): boolean {
  return useAppStatus((s) => s.config?.notificationsEnabled ?? true);
}

/** La zone n'existe que pour un compte qui a un profil : sans lui, rien ne peut arriver (D12). */
export function useNotificationsReady(): boolean {
  const on = useNotificationsEnabled();
  const { viewerId, hasProfile } = useViewer();
  return on && hasProfile && viewerId !== null;
}

/** Le nombre de lignes nouvelles (D8) ; 0 tant qu'il n'y a rien à lire. */
export function useNotificationBadge(): number {
  const ready = useNotificationsReady();
  const { viewerId } = useViewer();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: notificationBadgeKey(viewerId),
    queryFn: () => fetchNotificationBadge(supabase),
    enabled: ready,
    staleTime: BADGE_STALE_MS,
  });

  useEffect(() => {
    if (!ready) return;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void client.invalidateQueries({ queryKey: [NOTIFICATIONS_ROOT] });
    });
    return () => subscription.remove();
  }, [ready, client]);

  return ready ? (query.data ?? 0) : 0;
}

/** À chaque changement d'onglet : relire le nombre, s'il date (D9). */
export function useBadgeRefresh(): () => void {
  const client = useQueryClient();
  const { viewerId } = useViewer();
  return useCallback(() => {
    void client.refetchQueries({ queryKey: notificationBadgeKey(viewerId), stale: true, type: 'active' });
  }, [client, viewerId]);
}

/** La zone, page par page (D22). */
export function useNotificationList(enabled: boolean) {
  const { viewerId } = useViewer();
  return useInfiniteQuery({
    queryKey: notificationListKey(viewerId),
    initialPageParam: null as NotificationCursor,
    queryFn: ({ pageParam }) => fetchNotifications(supabase, pageParam),
    getNextPageParam: (last) => notificationCursor(last),
    enabled: enabled && viewerId !== null,
  });
}
