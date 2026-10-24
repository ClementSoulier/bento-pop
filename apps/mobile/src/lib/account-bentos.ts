import { infiniteQueryOptions } from '@tanstack/react-query';
import { loadFeedPage, type FeedClient, type FeedCursor } from './feed';

/**
 * Les autres bentos publiés d'un compte, pour la liste qui suit son bento sur
 * sa page (chantier 21, D1, D2, D11).
 *
 * La requête du fil, limitée au compte et sans le bento que la page montre
 * déjà : même ordre, même curseur, mêmes huit bentos par page, et chacun s'y
 * lit comme dans « La table ». Chargée à part de la page, après elle : le
 * premier écran ne l'attend jamais, et une liste longue d'éditions ne pèse
 * que ce qu'on en voit.
 */

export const ACCOUNT_BENTOS_QUERY_ROOT = 'account-bentos';

/** Cinq minutes, comme les matchs : un compte publie au plus une fois par semaine. */
export const ACCOUNT_BENTOS_STALE_MS = 5 * 60 * 1000;

export function accountBentosQueryOptions(
  client: FeedClient,
  userId: string,
  excludeBentoId: string | null,
) {
  return infiniteQueryOptions({
    queryKey: [ACCOUNT_BENTOS_QUERY_ROOT, userId, excludeBentoId] as const,
    initialPageParam: null as FeedCursor | null,
    queryFn: ({ pageParam }) => loadFeedPage(client, pageParam, { userId, excludeBentoId }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: ACCOUNT_BENTOS_STALE_MS,
    enabled: userId !== '',
  });
}
