import { queryOptions } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/supabase/types';

/**
 * Les anciens liens, chantier 21 (D6) : `/u/<ancien>` mène pour toujours au
 * profil sous le nouveau pseudo. La page d'un pseudo introuvable demande à la
 * base quel compte l'a porté, puis remplace l'adresse.
 *
 * Client injecté, pour que la forme de l'appel se vérifie sous `node:test`.
 */

export type RedirectClient = SupabaseClient<Database>;

export const RESOLVE_PSEUDO_QUERY_ROOT = 'resolve-pseudo';

/** Le pseudo actuel du compte qui a porté celui-ci, ou `null`. Lève sur une erreur. */
export async function resolveOldPseudo(client: RedirectClient, pseudo: string): Promise<string | null> {
  const { data, error } = await client.rpc('resolve_pseudo', { p_pseudo: pseudo.trim() });
  if (error) throw new Error(`Pseudo resolution failed: ${error.message}`);
  return typeof data === 'string' && data.trim() !== '' ? data : null;
}

/** L'adresse sous le nouveau pseudo, le bento nommé compris. */
export function redirectPath(current: string, slug: string | null): `/u/${string}` {
  return slug ? `/u/${current}/${slug}` : `/u/${current}`;
}

export function resolvePseudoQueryOptions(client: RedirectClient, pseudo: string) {
  return queryOptions({
    queryKey: [RESOLVE_PSEUDO_QUERY_ROOT, pseudo.toLowerCase()] as const,
    queryFn: () => resolveOldPseudo(client, pseudo),
    // Un ancien pseudo mène toujours au même compte, mais ce compte peut
    // changer encore : cinq minutes, comme les autres lectures publiques.
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
