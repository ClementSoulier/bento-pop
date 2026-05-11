import { QueryClient } from '@tanstack/react-query';

/**
 * React Query client de l'app mobile.
 * - staleTime généreux (1 min) : les bentos publiés ne bougent pas vite.
 * - retry désactivé pour les erreurs 4xx (auth, validation).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: (failureCount, error) => {
        const status = (error as { status?: number })?.status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});
