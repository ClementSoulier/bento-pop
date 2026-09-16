import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Slots } from '@/lib/bento-slots';

/**
 * Le brouillon d'avant compte, gardé sur l'appareil.
 *
 * Chantier 9. Le pseudo était exigé à l'écran 3 sur 4, avant que quiconque ait
 * vu une case remplie. Mesuré le 16 septembre 2026 : **34 comptes sur 61, soit
 * 56 %, portent un pseudo unique et n'ont jamais rien publié**. Chacun a
 * réservé une adresse que personne d'autre ne peut prendre, pour une boîte que
 * personne ne verra.
 *
 * On laisse donc composer d'abord. Tant qu'il n'y a pas de profil, rien ne
 * part au serveur : `bentos.user_id` référence `users(id)`, donc aucune case
 * ne peut exister côté serveur sans ligne de profil. Les cases vivent ici,
 * persistées, et `publish_first_bento` crée profil, bento, cases et
 * publication en une transaction au moment de publier.
 *
 * **Séparé de `useBento`** délibérément. `useBento` est l'état du bento qu'on
 * édite, hydraté depuis le serveur et remis à zéro à la déconnexion ; celui-ci
 * est une note sur l'appareil, qui doit survivre à tout cela jusqu'à la
 * publication. Les mélanger ferait qu'une hydratation ratée efface un
 * brouillon, ce qui est exactement ce qu'il ne faut pas.
 */

type DraftState = {
  /** Les cases composées avant d'avoir un compte. */
  slots: Slots;
  /**
   * Quand les règles du jeu ont été acceptées, sur cet appareil.
   *
   * Gardé ici parce que `terms_accepted_at` était posé dans l'`INSERT` du
   * profil, c'est-à-dire au choix du pseudo. Le pseudo recule, l'acceptation
   * ne bouge pas : elle reste avant toute contribution publique, comme
   * l'exige la Guideline 1.2 de l'App Store, et c'est cette date que
   * `publish_first_bento` inscrit.
   */
  termsAcceptedAt: string | null;
  /** La persistance a-t-elle fini de relire l'appareil ? */
  hydrated: boolean;
  setSlot: (slots: Slots) => void;
  acceptTerms: () => void;
  /** Après publication : le brouillon a trouvé sa place en base. */
  clear: () => void;
};

export const useDraft = create<DraftState>()(
  persist(
    (set) => ({
      slots: {},
      termsAcceptedAt: null,
      hydrated: false,
      setSlot: (slots) => set({ slots }),
      acceptTerms: () => set({ termsAcceptedAt: new Date().toISOString() }),
      clear: () => set({ slots: {} }),
    }),
    {
      name: 'bento-pop-draft',
      storage: createJSONStorage(() => AsyncStorage),
      // `hydrated` ne se persiste pas : c'est un fait sur cette exécution.
      partialize: (s) => ({ slots: s.slots, termsAcceptedAt: s.termsAcceptedAt }),
      onRehydrateStorage: () => (state) => {
        // Appelé même si la relecture échoue, `state` valant alors `undefined` :
        // un stockage illisible ne doit pas laisser l'app attendre pour
        // toujours, pour la même raison que `markHydrated` côté bento.
        useDraft.setState({ hydrated: true });
        void state;
      },
    },
  ),
);
