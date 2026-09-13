import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '@/supabase/client';
import { describeApp, recordVisit } from '@/lib/telemetry';
import type { Database } from '@/supabase/types';
import { useBento } from '@/state/bento';
import { CATEGORY_BY_ID, paletteKeyForItem } from '@bento-pop/supabase-mobile/bento';
import { withTimeout } from '@/lib/with-timeout';

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
        await get().refreshProfile().catch(() => {
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
      return;
    }
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    set({ profile: data ?? null });
    // Si le profil existe, on hydrate aussi le bento (slots déjà créés).
    if (data) {
      await hydrateBentoFromRemote(userId);
    }
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
 * Charge le bento de l'utilisateur depuis Supabase et l'injecte dans le
 * store local. La palette est choisie cycliquement selon l'index (pas de
 * persistance de la palette en BDD pour le MVP — c'est purement décoratif).
 */
async function hydrateBentoFromRemote(userId: string) {
  const { data } = await supabase
    .from('bentos')
    .select(
      `id,
       published_at,
       bento_items (
         category_id,
         items ( id, title, subtitle, image_url, image_credit, status )
       )`,
    )
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) return;
  // Posé avant les cases : c'est ce qui décide du libellé du CTA, et on ne
  // veut pas d'une frame où le bento est plein mais encore « à publier ».
  useBento.getState().setPublishedAt(data.published_at);
  if (!data.bento_items) return;
  const slots: ReturnType<typeof useBento.getState>['slots'] = {};
  data.bento_items.forEach((bi, idx) => {
    const cat = CATEGORY_BY_ID[bi.category_id];
    const item = bi.items as
      | {
          id: string;
          title: string;
          subtitle: string | null;
          image_url: string | null;
          image_credit: string | null;
          status: string;
        }
      | null;
    if (!cat || !item) return;
    slots[cat] = {
      title: item.title,
      subtitle: item.subtitle ?? undefined,
      imageUrl: item.image_url ?? undefined,
      imageCredit: item.image_credit ?? undefined,
      paletteKey: paletteKeyForItem(item.id),
      itemId: item.id,
      pending: item.status === 'pending',
    };
  });
  useBento.getState().hydrate(slots);
}
