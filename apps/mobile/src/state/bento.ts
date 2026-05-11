import { create } from 'zustand';
import type { CategoryKey } from '@/supabase/types';
import type { TileData } from '@/components/bento/Tile';

/**
 * État local du bento en cours de composition / édition.
 *
 * Stocké en mémoire seulement — la persistance Supabase se fait au moment
 * où l'utilisateur tap « Publier » (P2.7). L'optimistic update se gère ici.
 *
 * Une fois publié, on rehydrate depuis Supabase au démarrage et on reflète
 * dans ce store pour permettre l'édition.
 */

type BentoSlots = Partial<Record<CategoryKey, TileData & { itemId?: string }>>;

type BentoState = {
  slots: BentoSlots;
  setSlot: (cat: CategoryKey, data: TileData & { itemId?: string }) => void;
  clearSlot: (cat: CategoryKey) => void;
  reset: () => void;
  hydrate: (slots: BentoSlots) => void;
  filledCount: () => number;
};

export const useBento = create<BentoState>((set, get) => ({
  slots: {},
  setSlot: (cat, data) => set((s) => ({ slots: { ...s.slots, [cat]: data } })),
  clearSlot: (cat) =>
    set((s) => {
      const next = { ...s.slots };
      delete next[cat];
      return { slots: next };
    }),
  reset: () => set({ slots: {} }),
  hydrate: (slots) => set({ slots }),
  filledCount: () => Object.keys(get().slots).length,
}));
