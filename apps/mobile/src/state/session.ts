import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { AUTH_STORAGE_KEY, supabase } from '@/supabase/client';
import { describeApp, recordVisit } from '@/lib/telemetry';
import type { Database } from '@/supabase/types';
import { useBento } from '@/state/bento';
import { useDraft } from '@/state/draft';
import { REMOTE_SLOT_COLUMNS, mapRemoteSlots } from '@/lib/bento-slots';
import { hydrateFromDraft } from '@/state/draft-hydrate';
import { refreshDraftStatuses } from '@/state/draft-refresh';
import { caseSetFor } from '@/lib/editions';
import { OWN_BENTO_COLUMNS, type OwnBentoRow, toOwnBento } from '@/lib/own-bento';
import { keptEmail } from '@/lib/account';
import { deleteOwnAccountNow } from '@/lib/account-actions';
import {
  DEVICE_ACCOUNT_KEY,
  bootSession,
  parseDeviceAccount,
  parseStoredSession,
  serializeDeviceAccount,
} from '@/lib/boot-session';
import { sessionEventAction } from '@/lib/session-events';

type Profile = Database['public']['Tables']['users']['Row'];

const INIT_TIMEOUT_MS = 8000;

type SessionState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  initialized: boolean;
  /**
   * Chantier 28, D6 : l'adresse d'un compte gardé dont la session a été
   * refusée pour de bon. L'app propose de s'y reconnecter plutôt que d'ouvrir
   * un compte neuf.
   */
  lostAccount: { email: string } | null;
  /**
   * Démarre la session, cf. `bootSession` : la session rangée, ou un compte
   * anonyme neuf sur un appareil qui n'en a jamais eu (D5). Puis charge le
   * profil. Appelé au démarrage, et après une déconnexion.
   */
  init: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /** Met à jour le profil local après création / update via UI. */
  setProfile: (profile: Profile | null) => void;
  /** Force l'état initialized (safety net depuis le root layout). */
  setInitialized: (value: boolean) => void;
  /**
   * Chantier 28 : passe sur la session d'un compte retrouvé par son code.
   * `dropCurrent` efface d'abord le compte de ce téléphone (D2, D9) ; son
   * échec n'arrête rien, le compte est alors seulement abandonné. Le
   * brouillon de ce téléphone est remplacé par le compte retrouvé.
   */
  switchTo: (next: Session, options: { dropCurrent: boolean }) => Promise<void>;
  /**
   * Réinitialise complètement : déconnexion, stores et brouillon remis à
   * zéro, marque de l'appareil effacée, puis un compte anonyme neuf. Après
   * une suppression de compte ou une déconnexion voulue (D8, D10), l'app
   * repart de zéro comme au premier lancement, accueil compris.
   */
  resetAndReinit: () => Promise<void>;
  /** Chantier 28, D6 : « Continuer sans compte », depuis « Reconnecte-toi ». */
  continueWithoutAccount: () => Promise<void>;
};

/**
 * L'app conduit elle-même la session : lancement, changement de compte,
 * déconnexion voulue. Les évènements de `auth-js` n'y décident rien, cf.
 * `sessionEventAction`. Un compteur et non un booléen : `resetAndReinit`
 * relance `init`.
 */
let steering = 0;
let listening = false;

/** La marque de l'appareil, que `bootSession` lit au lancement suivant. */
async function rememberDevice(user: User): Promise<void> {
  await AsyncStorage.setItem(
    DEVICE_ACCOUNT_KEY,
    serializeDeviceAccount({ userId: user.id, email: keptEmail(user) }),
  ).catch((e) => console.warn('[session] marque de l’appareil', e));
}

export const useSession = create<SessionState>((set, get) => {
  /**
   * Suit la session, une fois pour toutes. Ce que l'app fait au-delà se
   * décide dans `sessionEventAction`, et se fait **hors du rappel** : `auth-js`
   * l'appelle sous son verrou, et un appel au client depuis lui attendrait ce
   * verrou pour toujours, comme le prévient la documentation de Supabase.
   */
  const listen = () => {
    if (listening) return;
    listening = true;
    supabase.auth.onAuthStateChange((event, newSession) => {
      const previousUserId = get().user?.id ?? null;
      const user = newSession?.user ?? null;
      set({ session: newSession, user });
      const action = sessionEventAction({
        event,
        userId: user?.id ?? null,
        previousUserId,
        steering: steering > 0,
      });
      setTimeout(() => {
        if (user) void rememberDevice(user);
        if (action === 'reload-profile') {
          set({ lostAccount: null });
          void get().refreshProfile();
        }
        if (action === 'session-lost') void sessionLost();
      }, 0);
    });
  };

  /**
   * La session a disparu sans qu'on l'ait demandé : son renouvellement a été
   * refusé pour de bon (D6). Un compte gardé se retrouve d'un code ; un
   * anonyme est perdu, et `init` en crée un neuf, comme au lancement.
   */
  const sessionLost = async () => {
    const device = parseDeviceAccount(await AsyncStorage.getItem(DEVICE_ACCOUNT_KEY).catch(() => null));
    useBento.getState().reset();
    set({ profile: null });
    if (device?.email) {
      set({ lostAccount: { email: device.email } });
      return;
    }
    await get().init();
  };

  return {
    session: null,
    user: null,
    profile: null,
    initialized: false,
    lostAccount: null,

    init: async () => {
      // Garde-fou : `initialized: true` est posé dans le finally pour que
      // l'utilisateur ne reste JAMAIS bloqué sur le splash, même si le
      // réseau est filtré ou si Supabase est down. Cf. rejet App Store
      // 2bf822e0 (review sur iPad Air M3 avec réseau restreint).
      steering += 1;
      try {
        listen();
        const outcome = await bootSession({
          auth: supabase.auth,
          readStoredSession: async () => parseStoredSession(await AsyncStorage.getItem(AUTH_STORAGE_KEY)),
          readDeviceAccount: async () => parseDeviceAccount(await AsyncStorage.getItem(DEVICE_ACCOUNT_KEY)),
          timeoutMs: INIT_TIMEOUT_MS,
        });

        if (outcome.kind === 'lost') {
          set({ session: null, user: null, lostAccount: { email: outcome.device.email } });
          return;
        }

        if (outcome.kind === 'session' || outcome.kind === 'created') {
          const session = outcome.session;
          set({ session, user: session.user, lostAccount: null });
          await rememberDevice(session.user);
          if (outcome.kind === 'created' && outcome.replacing) {
            // D6 : la seule perte que rien ne rattrape, un compte anonyme dont
            // la session a été refusée. Au journal, pour la compter.
            console.warn('[session] compte anonyme perdu, remplacé', outcome.replacing);
          }
        }

        // 'pending' : la session rangée se renouvelle encore, elle arrivera
        // par `onAuthStateChange` (D5). 'offline' : aucun compte. Dans les
        // deux cas l'app s'ouvre comme hors ligne, sur le brouillon.
        await get()
          .refreshProfile()
          .catch(() => {
            // refreshProfile non bloquant : profil resté `null`, l'app ouvre
            // sur l'onboarding ou un state vide.
          });

        // Télémétrie : une fois par lancement, ici et pas dans
        // `refreshProfile`, que le composer rappelle à chaque retour
        // d'onglet. Lancée sans être attendue et sans remonter d'erreur :
        // le back-office peut se passer d'une ligne, pas l'utilisateur d'un
        // démarrage. Après `refreshProfile` : sans profil il n'y a rien à
        // mettre à jour.
        const userId = get().user?.id;
        if (userId && get().profile) {
          void recordVisit(supabase, userId, describeApp(Platform.OS, Constants.expoConfig?.version));
        }
      } finally {
        steering -= 1;
        set({ initialized: true });
      }
    },

    refreshProfile: async () => {
      const userId = get().user?.id;
      if (!userId) {
        set({ profile: null });
        useBento.getState().markHydrated();
        return;
      }
      try {
        const { data } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
        set({ profile: data ?? null });
        // Si le profil existe, on hydrate aussi le bento (slots déjà créés).
        if (data) {
          await hydrateBentoFromRemote(userId);
          return;
        }
      } catch (e) {
        // Hors ligne, la lecture jette. Le profil déjà connu reste : l'effacer
        // renverrait à l'inscription quelqu'un qui a un compte. Et le composer
        // n'a plus rien à attendre, sans quoi il garderait son squelette et son
        // bouton « Chargement… » pour toujours, cf. `markHydrated`.
        console.warn('[session] lecture du profil', e);
      }
      // La lecture a répondu, même pour dire qu'il n'y a rien, ou elle a échoué.
      // Sans profil, ce que le composer doit montrer est le brouillon gardé sur
      // l'appareil, et non une boîte vide : chantier 9.
      if (!get().profile) {
        hydrateFromDraft();
        // Chantier 17, D25 : les propositions du brouillon, relues en base. Une
        // proposition validée n'y reste plus « en attente ».
        void refreshDraftStatuses();
        return;
      }
      useBento.getState().markHydrated();
    },

    setProfile: (profile) => set({ profile }),

    setInitialized: (value) => set({ initialized: value }),

    switchTo: async (next, { dropCurrent }) => {
      steering += 1;
      try {
        if (dropCurrent && get().session) {
          await deleteOwnAccountNow(supabase).catch((e) =>
            console.warn('[session] effacer le compte de ce téléphone', e),
          );
        }
        const { error } = await supabase.auth.setSession({
          access_token: next.access_token,
          refresh_token: next.refresh_token,
        });
        if (error) throw error;
        await rememberDevice(next.user);
        useDraft.getState().clear();
        useBento.getState().reset();
        set({ session: next, user: next.user, profile: null, lostAccount: null });
      } finally {
        steering -= 1;
      }
      await get().refreshProfile();
    },

    resetAndReinit: async () => {
      steering += 1;
      try {
        // La marque d'abord : effacée, le lancement suivant est un premier
        // lancement, même si la déconnexion échoue en chemin.
        await AsyncStorage.removeItem(DEVICE_ACCOUNT_KEY).catch(() => {});
        // `local` : un compte gardé reste ouvert sur ses autres téléphones.
        await supabase.auth.signOut({ scope: 'local' });
        useBento.getState().reset();
        useDraft.getState().reset();
        set({ session: null, user: null, profile: null, lostAccount: null, initialized: false });
      } finally {
        steering -= 1;
      }
      // Relance un anonymous sign-in propre → nouveau auth.uid
      await get().init();
    },

    continueWithoutAccount: async () => {
      await AsyncStorage.removeItem(DEVICE_ACCOUNT_KEY).catch(() => {});
      set({ lostAccount: null, initialized: false });
      await get().init();
    },
  };
});

/**
 * Charge les bentos du compte et hydrate le store local.
 *
 * La palette est choisie cycliquement selon l'index (pas de persistance de la
 * palette en BDD pour le MVP, c'est purement décoratif).
 *
 * **Une liste et non « le » bento**, chantier 16. La lecture rapporte tous les
 * bentos du compte, le store les garde, et les cases hydratées sont celles du
 * bento courant, c'est-à-dire le principal au démarrage.
 */
async function hydrateBentoFromRemote(userId: string) {
  const rows = await readBentos(userId);
  if (rows === null) {
    // La lecture a échoué. Elle a répondu quand même, du point de vue du
    // composer, qui ne doit pas attendre plus, cf. `markHydrated`.
    useBento.getState().markHydrated();
    return;
  }

  useBento.getState().setOwn(rows.map(toOwnBento));

  const courant = useBento.getState().current;
  const ligne = courant ? rows.find((b) => b.id === courant.id) : undefined;
  if (!ligne?.bento_items) {
    useBento.getState().markHydrated();
    return;
  }

  // Le jeu de cases du bento courant, avant ses cases remplies : une édition
  // n'a pas les six du principal, et `slots` s'indexe par clé de case.
  const cases = await caseSetFor(useBento.getState().current);
  useBento.getState().setCases(cases);
  useBento.getState().hydrate(mapRemoteSlots(ligne.bento_items, cases));
}

type RemoteBento = OwnBentoRow & {
  bento_items:
    | { category_id: number; items: unknown }[]
    | null;
};

/**
 * La lecture elle-même. Son échec ne remonte pas : hors ligne, une exception
 * ici laissait le composer attendre une réponse qui n'arriverait jamais. Elle
 * rend `null` pour dire « la lecture a échoué », et une liste vide pour dire
 * « ce compte n'a pas encore de bento », deux choses différentes.
 */
async function readBentos(userId: string): Promise<RemoteBento[] | null> {
  try {
    const { data, error } = await supabase
      .from('bentos')
      // Les colonnes du bento sont celles de `toOwnBento`, et non une copie :
      // la marque du chantier 18 y serait sinon oubliée.
      .select(`${OWN_BENTO_COLUMNS}, bento_items ( ${REMOTE_SLOT_COLUMNS} )`)
      .eq('user_id', userId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });
    if (error) {
      console.warn('[session] lecture des bentos', error.message);
      return null;
    }
    return (data ?? []) as unknown as RemoteBento[];
  } catch (e) {
    console.warn('[session] lecture des bentos', e);
    return null;
  }
}
