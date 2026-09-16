import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '@/supabase/client';
import { describeApp, recordVisit } from '@/lib/telemetry';
import type { Database } from '@/supabase/types';
import { useBento } from '@/state/bento';
import { mapRemoteSlots } from '@/lib/bento-slots';
import { hydrateFromDraft } from '@/state/draft-hydrate';
import { withTimeout } from '@/lib/with-timeout';
import { caseSetFor } from '@/lib/bento-actions';

type Profile = Database['public']['Tables']['users']['Row'];

const INIT_TIMEOUT_MS = 8000;

type SessionState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  initialized: boolean;
  /**
   * Démarre la session : signInAnonymously si pas déjà connecté, puis
   * charge le profil public correspondant. À appeler une fois au boot.
   */
  init: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /** Met à jour le profil local après création / update via UI. */
  setProfile: (profile: Profile | null) => void;
  /** Force l'état initialized (safety net depuis le root layout). */
  setInitialized: (value: boolean) => void;
  /**
   * Réinitialise complètement : signOut Supabase + reset stores +
   * relance un anonymous sign-in (nouveau UUID, profil vide).
   * Utilisé après une suppression de compte → l'utilisateur repart
   * de zéro comme au 1er lancement.
   */
  resetAndReinit: () => Promise<void>;
};

export const useSession = create<SessionState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  initialized: false,

  init: async () => {
    // Garde-fou : `initialized: true` est posé dans le finally pour que
    // l'utilisateur ne reste JAMAIS bloqué sur le splash, même si le
    // réseau est filtré ou si Supabase est down. Cf. rejet App Store
    // 2bf822e0 (review sur iPad Air M3 avec réseau restreint).
    try {
      // 1. Récupère la session existante (persistée via AsyncStorage),
      //    avec timeout pour éviter de hang indéfiniment au boot.
      const existing = await withTimeout(
        supabase.auth.getSession().then(({ data }) => data.session),
        INIT_TIMEOUT_MS,
        null,
      );

      let session = existing;
      if (!session) {
        // 2. Premier lancement : sign-in anonyme. L'uid devient le pivot
        //    de toutes les RLS et persistera même après "claim" (v2).
        //    Si ça échoue (réseau, anonymous désactivé côté Supabase, etc.)
        //    on laisse `session: null` et on continue : l'app s'ouvre en
        //    mode dégradé plutôt que de rester sur le splash.
        const signIn = supabase.auth.signInAnonymously().then(({ data, error }) => {
          if (error) throw error;
          return data.session;
        });
        session = await withTimeout(signIn, INIT_TIMEOUT_MS, null);
      }

      set({ session, user: session?.user ?? null });
      if (session) {
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
        if (get().profile) {
          void recordVisit(
            supabase,
            session.user.id,
            describeApp(Platform.OS, Constants.expoConfig?.version),
          );
        }
      }

      // 3. Écoute les changements de session (refresh token, logout futur)
      supabase.auth.onAuthStateChange((_event, newSession) => {
        set({ session: newSession, user: newSession?.user ?? null });
      });
    } finally {
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
      return;
    }
    useBento.getState().markHydrated();
  },

  setProfile: (profile) => set({ profile }),

  setInitialized: (value) => set({ initialized: value }),

  resetAndReinit: async () => {
    // Sign-out → onAuthStateChange clear session, user, profile
    await supabase.auth.signOut();
    useBento.getState().reset();
    set({ session: null, user: null, profile: null, initialized: false });
    // Relance un anonymous sign-in propre → nouveau auth.uid
    await get().init();
  },
}));

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

  useBento.getState().setOwn(
    rows.map((b) => ({
      id: b.id,
      slug: b.slug,
      isPrimary: b.is_primary,
      editionId: b.edition_id,
      publishedAt: b.published_at,
    })),
  );

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

type RemoteBento = {
  id: string;
  slug: string;
  is_primary: boolean;
  edition_id: number | null;
  published_at: string | null;
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
      .select(
        `id,
       slug,
       is_primary,
       edition_id,
       published_at,
       bento_items (
         category_id,
         items ( id, title, subtitle, image_url, image_credit, status )
       )`,
      )
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
