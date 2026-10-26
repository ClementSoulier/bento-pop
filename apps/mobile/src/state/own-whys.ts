import { create } from 'zustand';
import { fetchOwnWhys } from '@/lib/why-actions';
import { toOwnWhys, type OwnWhy } from '@/lib/whys';
import { supabase } from '@/supabase/client';

/**
 * Les pourquoi de ses propres bentos, chantier 12, masqués compris (D8).
 *
 * Trois lecteurs : la page de son bento, qui les montre avec leur motif ;
 * l'écran « Tes pourquoi », qui les modifie ; et le compositeur, qui demande
 * avant de remplacer ou de vider une case expliquée (D7). La base reste la
 * référence : remplacer ou vider efface le pourquoi de son côté, `drop` le
 * reflète ici sans attendre une relecture.
 */

type Whys = Readonly<Partial<Record<string, OwnWhy>>>;

type OwnWhysState = {
  byBento: Readonly<Record<string, Whys>>;
  /** Relit les pourquoi d'un bento ; une panne garde ce qui était connu. */
  load: (bentoId: string) => Promise<void>;
  /** Pose ce que la base a gardé pour une case, ou l'efface (`null`). */
  put: (bentoId: string, caseKey: string, why: OwnWhy | null) => void;
  /** Ce que la case avait de pourquoi : le compositeur demande avant de l'effacer. */
  has: (bentoId: string | null | undefined, caseKey: string) => boolean;
  reset: () => void;
};

export const useOwnWhys = create<OwnWhysState>((set, get) => ({
  byBento: {},

  load: async (bentoId) => {
    try {
      const rows = await fetchOwnWhys(supabase, bentoId);
      set((s) => ({ byBento: { ...s.byBento, [bentoId]: toOwnWhys(rows) } }));
    } catch (e) {
      console.warn('[pourquoi] lecture des siens', e);
    }
  },

  put: (bentoId, caseKey, why) =>
    set((s) => {
      const current = { ...(s.byBento[bentoId] ?? {}) };
      if (why) current[caseKey] = why;
      else delete current[caseKey];
      return { byBento: { ...s.byBento, [bentoId]: current } };
    }),

  has: (bentoId, caseKey) => Boolean(bentoId && get().byBento[bentoId]?.[caseKey]),

  reset: () => set({ byBento: {} }),
}));
