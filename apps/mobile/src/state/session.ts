import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/supabase/client';
import type { CategoryKey, Database } from '@/supabase/types';
import { useBento } from '@/state/bento';
import { PALETTES, type PaletteKey } from '@/components/bento/palettes';

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
};

export const useSession = create<SessionState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  initialized: false,

  init: async () => {
    // 1. Récupère la session existante (persistée via AsyncStorage)
    const { data: { session: existing } } = await supabase.auth.getSession();

    let session = existing;
    if (!session) {
      // 2. Premier lancement : sign-in anonyme. L'uid devient le pivot
      //    de toutes les RLS et persistera même après "claim" (v2).
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      session = data.session;
    }

    set({ session, user: session?.user ?? null });
    await get().refreshProfile();
    set({ initialized: true });

    // 3. Écoute les changements de session (refresh token, logout futur)
    supabase.auth.onAuthStateChange((_event, newSession) => {
      set({ session: newSession, user: newSession?.user ?? null });
    });
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
