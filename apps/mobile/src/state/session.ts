import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/supabase/client';
import type { Database } from '@/supabase/types';

type Profile = Database['public']['Tables']['users']['Row'];

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
  },

  setProfile: (profile) => set({ profile }),
}));
