import { infiniteQueryOptions } from '@tanstack/react-query';
import { loadFeedPage, type FeedClient, type FeedCursor, type FeedPage } from './feed';

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

/** Le bento que la page montre, et que sa liste ne redit pas. */
export type ShownBento = { id: string; isPrimary: boolean };

export function accountBentosQueryOptions(client: FeedClient, userId: string, shown: ShownBento) {
  return infiniteQueryOptions({
    queryKey: [ACCOUNT_BENTOS_QUERY_ROOT, userId, shown.id] as const,
    initialPageParam: null as FeedCursor | null,
    queryFn: ({ pageParam }) => loadAccountBentosPage(client, userId, shown, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: ACCOUNT_BENTOS_STALE_MS,
    enabled: userId !== '',
  });
}

/**
 * Une page de la liste. Sous un bento nommé, le principal passe en tête
 * (§5.1) : la première page le demande à part, en même temps que les autres,
 * et les pages suivantes ne lisent plus que les autres, dans l'ordre du fil.
 */
export async function loadAccountBentosPage(
  client: FeedClient,
  userId: string,
  shown: ShownBento,
  cursor: FeedCursor | null,
): Promise<FeedPage> {
  if (shown.isPrimary) return loadFeedPage(client, cursor, { userId, excludeBentoId: shown.id });

  const others = loadFeedPage(client, cursor, { userId, excludeBentoId: shown.id, primary: false });
  if (cursor) return others;
  const [primary, page] = await Promise.all([
    loadFeedPage(client, null, { userId, primary: true }),
    others,
  ]);
  return { bentos: [...primary.bentos, ...page.bentos], nextCursor: page.nextCursor };
}
