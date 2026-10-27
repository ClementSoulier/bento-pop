import { useQuery } from '@tanstack/react-query';
import { useViewer } from '@/components/follows/use-follows';
import { fetchSocialLinks, socialLinksKey } from '@/lib/social-link-actions';
import { useAppStatus } from '@/state/app-status';
import { supabase } from '@/supabase/client';

/**
 * Les crochets du chantier 25 : l'interrupteur, et les liens d'un compte. Les
 * règles vivent dans la base ; ces crochets tiennent l'écran à jour.
 */

/** L'interrupteur (D9), allumé tant que la configuration n'a pas répondu. */
export function useSocialLinksEnabled(): boolean {
  return useAppStatus((s) => s.config?.socialLinksEnabled ?? true);
}

/**
 * Les liens d'un compte, lus avec la session : son titulaire les lit même
 * masqués, avec son réglage (D3). `null` sans lien, `undefined` tant que la
 * base n'a pas répondu.
 */
export function useSocialLinks(userId: string | null) {
  const enabled = useSocialLinksEnabled();
  const { viewerId } = useViewer();
  return useQuery({
    queryKey: socialLinksKey(userId ?? '', viewerId),
    queryFn: () => fetchSocialLinks(supabase, userId ?? ''),
    enabled: enabled && Boolean(userId),
    staleTime: 30_000,
  });
}
