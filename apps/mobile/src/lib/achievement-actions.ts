import type { SupabaseClient } from '@supabase/supabase-js';
import type { AchievementRow, Database } from '@/supabase/types';

/**
 * La lecture du chantier 27 : les succès d'un compte, par la fonction de la
 * base, seul chemin des clients (D8). La même pour tous, sans session : la
 * page d'un compte ne l'attend jamais.
 *
 * Le client est passé en argument, comme dans `social-link-actions.ts`, pour
 * être testé contre un bouchon.
 */

export type AchievementsClient = SupabaseClient<Database>;

/** Racine des clés React Query des succès, pour les invalider d'un coup. */
export const ACHIEVEMENTS_QUERY_ROOT = 'achievements';

export const achievementsKey = (userId: string) => [ACHIEVEMENTS_QUERY_ROOT, userId] as const;

/** Les succès d'un compte, du plus ancien au plus récent ; vide interrupteur éteint. */
export async function fetchAchievements(client: AchievementsClient, userId: string): Promise<AchievementRow[]> {
  const { data, error } = await client.rpc('account_achievements_of', { p_user: userId });
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data : [];
}
