import { create } from 'zustand';
import { AppState, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  type AppConfig,
  type AppStatus,
  deriveAppStatus,
  deriveLatestVersion,
  fetchAppConfig,
  getCurrentAppVersion,
} from '@/lib/app-config';
import { shouldOfferUpdate } from '@/lib/version';
import { withTimeout } from '@/lib/with-timeout';

/**
 * Store qui suit l'état runtime de l'app : maintenance, force update, ou OK.
 *
 * Stratégie :
 *  - Fetch initial au boot (depuis `_layout.tsx`), en parallèle de session.init.
 *  - Refetch automatique à chaque retour au premier plan via `AppState`,
 *    pour basculer en maintenance sans avoir à relancer l'app.
 *  - Fail-open : si la requête échoue (offline, downtime Supabase, RLS
 *    cassée), on reste sur 'ok' plutôt que de bloquer tout le monde.
 *
 * Il porte aussi l'invitation DOUCE à mettre à jour (`offerUpdate`), qui
 * n'est pas une valeur d'`AppStatus` : le statut pilote un écran qui remplace
 * l'app, l'invitation cohabite avec elle. Deux mécanismes distincts, deux
 * champs distincts.
 */

/** Version du store dont l'invitation a été refusée. Cf. `dismissUpdate`. */
const DISMISSED_KEY = 'bp_update_dismissed';

/**
 * Plafond de la lecture du refus. C'est un accès disque local, donc rapide,
 * mais il est sur le chemin critique du splash : on ne laisse aucune attente
 * non bornée y entrer, quelle qu'en soit la probabilité.
 */
const DISMISSED_READ_TIMEOUT_MS = 1000;

type AppStatusState = {
  status: AppStatus;
  config: AppConfig | null;
  /** Vrai tant qu'on n'a pas eu de premier verdict (avant boot). */
  loading: boolean;
  /** Version publiée sur le store, ou `null` si le BO ne l'a pas renseignée. */
  latestVersion: string | null;
  /** Version déjà refusée par l'utilisateur, hydratée depuis AsyncStorage. */
  dismissedVersion: string | null;
  /** Vrai quand il faut afficher le bandeau « nouvelle version ». */
  offerUpdate: boolean;
  /** Init au boot. Idempotent : safe de l'appeler plusieurs fois. */
  init: () => Promise<void>;
  /** Refetch manuel (utilisé par AppState listener et pour debug). */
  refresh: () => Promise<void>;
  /** Libère le splash sans attendre le réseau (garde-fou du root layout). */
  stopLoading: () => void;
  /** « Plus tard » : mémorise le refus pour CETTE version seulement. */
  dismissUpdate: () => Promise<void>;
};

let appStateListener: ReturnType<typeof AppState.addEventListener> | null = null;

export const useAppStatus = create<AppStatusState>((set, get) => ({
  status: 'ok',
  config: null,
  loading: true,
  latestVersion: null,
  dismissedVersion: null,
  offerUpdate: false,

  init: async () => {
    // Le refus est lu AVANT la config : sinon un premier rendu afficherait le
    // bandeau une fraction de seconde avant de le retirer.
    await hydrateDismissed(set);
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
    const latestVersion = deriveLatestVersion(config);
    set({
      config,
      status: deriveAppStatus(config),
      latestVersion,
      offerUpdate: shouldOfferUpdate(
        getCurrentAppVersion(),
        latestVersion,
        get().dismissedVersion,
      ),
    });
  },

  stopLoading: () => set({ loading: false }),

  dismissUpdate: async () => {
    const version = get().latestVersion;
    set({ dismissedVersion: version, offerUpdate: false });
    if (!version) return;
    try {
      await AsyncStorage.setItem(DISMISSED_KEY, version);
    } catch {
      // Storage indisponible : le bandeau revient au prochain lancement.
      // Dégradation acceptable, on ne bloque pas sur du confort.
    }
  },
}));

/**
 * Hydrate le refus mémorisé. Même discipline que `state/blocked.ts` : un
 * storage indisponible dégrade vers « pas de refus », jamais vers un plantage.
 */
async function hydrateDismissed(set: (partial: Partial<AppStatusState>) => void) {
  try {
    const raw = await withTimeout(
      AsyncStorage.getItem(DISMISSED_KEY),
      DISMISSED_READ_TIMEOUT_MS,
      null,
    );
    if (raw) set({ dismissedVersion: raw });
  } catch {
    // rien à faire : on repart sans refus mémorisé
  }
}
