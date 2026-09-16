import type { QueryClient } from '@tanstack/react-query';
import { withAbortTimeout } from './abort-timeout';
import { FEED_QUERY_KEY } from './feed';
import { loadPublicBento, type PublicBentoClient, type PublicBentoResult } from './public-bento';

/**
 * Cache de la page bento publique.
 *
 * Pur, pour que ce qui compte se vérifie sous `node:test` : la remise à zéro
 * après une mutation, qui ne se voit à l'écran que le temps d'un aller-retour,
 * et la politique d'abandon, qui ne se voit que sur un mauvais réseau.
 *
 * Cf. `docs/UX-07-PAGE-BENTO-PUBLIQUE-MOBILE.md` §5.3 et §6.3.
 */

/** Préfixe de toutes les pages publiques en cache. */
export const PUBLIC_BENTO_QUERY_ROOT = 'public-bento';

/**
 * Cinq minutes : un bento publié change rarement, et les changements qui
 * comptent viennent de son propriétaire, sur cet appareil, qui remet alors le
 * cache à zéro.
 */
export const PUBLIC_BENTO_STALE_TIME_MS = 5 * 60 * 1000;

/**
 * 5 s par tentative et un seul réessai : « Connexion perdue » s'affiche en
 * 11 s au plus sur un réseau qui ne répond pas, la seconde du milieu étant la
 * pause de React Query avant de réessayer. La politique globale de
 * `query-client.ts` réessaie deux fois sans aucun délai d'abandon.
 */
export const PUBLIC_BENTO_TIMEOUT_MS = 5000;
export const PUBLIC_BENTO_RETRIES = 1;

/**
 * En minuscules : `@Dark_Hifus` et `@dark_hifus` sont le même bento, et
 * doivent partager une entrée de cache au lieu d'en occuper deux.
 *
 * Le slug fait partie de la clé depuis le chantier 16 : `/u/x` et
 * `/u/x/hebdo-38` sont deux pages, et servir l'une à la place de l'autre
 * afficherait le mauvais bento. `null` désigne la page du compte, dont le
 * contenu principal est le bento principal.
 */
export function publicBentoQueryKey(pseudo: string, slug: string | null = null) {
  return [PUBLIC_BENTO_QUERY_ROOT, pseudo.trim().toLowerCase(), slug] as const;
}

/**
 * Réessayer une panne, jamais un refus. Une 4xx est une requête que PostgREST
 * refusera encore : la réessayer ne ferait que retarder l'écran d'erreur.
 */
export function shouldRetryPublicBento(failureCount: number, error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  if (typeof status === 'number' && status >= 400 && status < 500) return false;
  return failureCount < PUBLIC_BENTO_RETRIES;
}

/** Options de `useQuery` pour une page publique. Le délai est un paramètre pour les tests. */
export function publicBentoQueryOptions(
  client: PublicBentoClient,
  pseudo: string,
  slug: string | null = null,
  timeoutMs: number = PUBLIC_BENTO_TIMEOUT_MS,
) {
  return {
    queryKey: publicBentoQueryKey(pseudo, slug),
    queryFn: ({ signal }: { signal: AbortSignal }): Promise<PublicBentoResult> =>
      withAbortTimeout(
        (attempt) =>
          loadPublicBento(client, pseudo, {
            signal: attempt,
            ...(slug === null ? {} : { slug }),
          }),
        timeoutMs,
        signal,
      ),
    staleTime: PUBLIC_BENTO_STALE_TIME_MS,
    retry: shouldRetryPublicBento,
  };
}

/**
 * À appeler après toute mutation qui change ce que montrent le fil ou une page
 * publique.
 *
 * Deux traitements, pas un. Le fil est **invalidé** : il resert son contenu
 * pendant qu'il se rafraîchit, ce qui convient à une liste. Les pages
 * publiques sont **remises à zéro** : une réponse périmée y dirait « rien en
 * ligne » juste après la publication, ou l'ancien film juste après un
 * changement de case. `invalidateQueries` sert l'ancienne réponse au premier
 * rendu, `resetQueries` rend le squelette ; les tests le vérifient.
 *
 * Le préfixe entier, parce que `bento-actions.ts` ne connaît que l'`id` de
 * l'utilisateur, pas son pseudo, et que le cache ne tient que quelques
 * entrées de 2 Ko.
 */
export function refreshPublicViews(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: FEED_QUERY_KEY });
  void queryClient.resetQueries({ queryKey: [PUBLIC_BENTO_QUERY_ROOT] });
}
