import { create } from 'zustand';
import { AppState, type AppStateStatus } from 'react-native';
import {
  type AppConfig,
  type AppStatus,
  deriveAppStatus,
  fetchAppConfig,
} from '@/lib/app-config';

/**
 * Store qui suit l'état runtime de l'app : maintenance, force update, ou OK.
 *
 * Stratégie :
 *  - Fetch initial au boot (depuis `_layout.tsx`), en parallèle de session.init.
 *  - Refetch automatique à chaque retour au premier plan via `AppState`,
 *    pour basculer en maintenance sans avoir à relancer l'app.
 *  - Fail-open : si la requête échoue (offline, downtime Supabase, RLS
 *    cassée), on reste sur 'ok' plutôt que de bloquer tout le monde.
 */

type AppStatusState = {
  status: AppStatus;
  config: AppConfig | null;
  /** Vrai tant qu'on n'a pas eu de premier verdict (avant boot). */
  loading: boolean;
  /** Init au boot. Idempotent : safe de l'appeler plusieurs fois. */
  init: () => Promise<void>;
  /** Refetch manuel (utilisé par AppState listener et pour debug). */
  refresh: () => Promise<void>;
};

let appStateListener: ReturnType<typeof AppState.addEventListener> | null = null;

export const useAppStatus = create<AppStatusState>((set, get) => ({
  status: 'ok',
  config: null,
  loading: true,

  init: async () => {
    await get().refresh();
    set({ loading: false });

    if (!appStateListener) {
      appStateListener = AppState.addEventListener('change', (next: AppStateStatus) => {
        if (next === 'active') {
          void get().refresh();
        }
      });
    }
  },

  refresh: async () => {
    const config = await fetchAppConfig();
    set({ config, status: deriveAppStatus(config) });
  },
}));
