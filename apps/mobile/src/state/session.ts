import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/supabase/client';
import type { CategoryKey, Database } from '@/supabase/types';
import { useBento } from '@/state/bento';
import { PALETTES, type PaletteKey } from '@/components/bento/palettes';
import { withTimeout } from '@/lib/with-timeout';

type Profile = Database['public']['Tables']['users']['Row'];

const CATEGORY_BY_ID: Record<number, CategoryKey> = {
  1: 'film',
  2: 'series',
  3: 'artist',
  4: 'track',
  5: 'creator',
  6: 'place',
};

const PALETTE_KEYS = Object.keys(PALETTES) as PaletteKey[];

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
       bento_items (
         category_id,
         items ( id, title, subtitle, image_url )
       )`,
    )
    .eq('user_id', userId)
    .maybeSingle();
  if (!data?.bento_items) return;
  const slots: ReturnType<typeof useBento.getState>['slots'] = {};
  data.bento_items.forEach((bi, idx) => {
    const cat = CATEGORY_BY_ID[bi.category_id];
    const item = bi.items as { id: string; title: string; subtitle: string | null; image_url: string | null } | null;
    if (!cat || !item) return;
    slots[cat] = {
      title: item.title,
      subtitle: item.subtitle ?? undefined,
      imageUrl: item.image_url ?? undefined,
      paletteKey: PALETTE_KEYS[idx % (PALETTE_KEYS.length - 1)] ?? 'neutral',
      itemId: item.id,
    };
  });
  useBento.getState().hydrate(slots);
}
