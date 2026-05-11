import { QueryClient } from '@tanstack/react-query';

/**
 * React Query client de l'app mobile.
 * - staleTime généreux par défaut (1 min) pour les données Supabase
 * - gcTime étendu (30 min) : on garde les caches en mémoire même quand
 *   l'utilisateur change d'écran, pour des retours instantanés
 * - retry désactivé pour les erreurs 4xx (auth, validation, not found)
 *
 * Les recherches externes (TMDb, MusicBrainz, Wikidata, OSM) overrident
 * `staleTime` à 10 min via leurs `useQuery` dédiés — un poster TMDb ne
 * change pas en 10 min, donc on évite les ré-appels (et on respecte les
 * rate limits MB / Nominatim de 1 req/seconde).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: (failureCount, error) => {
        const status = (error as { status?: number })?.status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});

/** staleTime utilisé pour les recherches externes (TMDb, MB, Wikidata, OSM). */
export const EXTERNAL_SEARCH_STALE_TIME = 10 * 60 * 1000;
