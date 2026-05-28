import { QueryClient } from '@tanstack/react-query';

/**
 * React Query client de l'app mobile.
 * - staleTime généreux par défaut (1 min) pour les données Supabase
 * - gcTime étendu (30 min) : on garde les caches en mémoire même quand
 *   l'utilisateur change d'écran, pour des retours instantanés
 * - retry désactivé pour les erreurs 4xx (auth, validation, not found)
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
