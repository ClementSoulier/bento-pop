import { useQuery } from '@tanstack/react-query';
import { achievementsKey, fetchAchievements } from '@/lib/achievement-actions';
import { useAppStatus } from '@/state/app-status';
import { publicSupabase } from '@/supabase/client';

/**
 * Les crochets du chantier 27 : l'interrupteur, et les succès d'un compte. Les
 * règles vivent dans la base ; ces crochets tiennent l'écran à jour.
 */

/** L'interrupteur (D18), allumé tant que la configuration n'a pas répondu. */
export function useAchievementsEnabled(): boolean {
  return useAppStatus((s) => s.config?.achievementsEnabled ?? true);
}

/**
 * Les succès d'un compte, par le client sans session, comme la page : ils sont
 * les mêmes pour tous (D2). `undefined` tant que la base n'a pas répondu.
 */
export function useAchievements(userId: string | null) {
  const enabled = useAchievementsEnabled();
  return useQuery({
    queryKey: achievementsKey(userId ?? ''),
    queryFn: () => fetchAchievements(publicSupabase, userId ?? ''),
    enabled: enabled && Boolean(userId),
    staleTime: 30_000,
  });
}
