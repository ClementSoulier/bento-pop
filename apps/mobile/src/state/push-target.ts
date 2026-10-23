import { create } from 'zustand';
import type { PushTarget } from '@/lib/push';

/**
 * Le tap d'une notification, entre le moment où il arrive et celui où le
 * composer peut le suivre. Chantier 17, lot 4 (D21, D22).
 *
 * Au démarrage par une notification, le tap arrive avant que la session et
 * le bento soient lus : il attend ici, et le composer le prend une fois prêt.
 */
type PushTargetState = {
  target: PushTarget | null;
  /** L'édition que le sélecteur met en avant, et un jeton qui rejoue l'animation. */
  spotlight: { editionId: number; seq: number } | null;
  /**
   * Un jeton qui fait pulser « Publier mon bento », au tap du rappel d'un
   * bento prêt. Chantier 8, D11.
   */
  publishSpotlight: number;
  set: (target: PushTarget) => void;
  /** Rend la cible et l'oublie : un tap ne se suit qu'une fois. */
  take: () => PushTarget | null;
  spotlightEdition: (editionId: number) => void;
  clearSpotlight: () => void;
  spotlightPublish: () => void;
};

export const usePushTarget = create<PushTargetState>((set, get) => ({
  target: null,
  spotlight: null,
  publishSpotlight: 0,
  set: (target) => set({ target }),
  take: () => {
    const { target } = get();
    set({ target: null });
    return target;
  },
  spotlightEdition: (editionId) =>
    set((s) => ({ spotlight: { editionId, seq: (s.spotlight?.seq ?? 0) + 1 } })),
  clearSpotlight: () => set({ spotlight: null }),
  spotlightPublish: () => set((s) => ({ publishSpotlight: s.publishSpotlight + 1 })),
}));
