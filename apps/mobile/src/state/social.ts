import { create } from 'zustand';
import { fetchBentoSocial, setLike } from '@/lib/social-actions';
import { withCommentDelta, withLikeToggled, type BentoSocial } from '@/lib/social';
import { supabase } from '@/supabase/client';

/**
 * Les nombres des bentos à l'écran, chantier 22 (D16) : un seul état pour le
 * fil, la page d'un compte, les mêmes goûts et la page d'un bento, pour que
 * le cœur touché ici se lise partout.
 *
 * Lus par paquets, après les bentos eux-mêmes : le premier écran ne les
 * attend jamais. Gardés une minute, puis relus à la demande suivante. Le
 * cœur suit le toucher tout de suite, et la base le confirme ou le défait.
 */

/** Au-delà, les nombres d'un bento se relisent. */
const FRESH_MS = 60 * 1000;

type SocialState = {
  byId: Record<string, BentoSocial>;
  loadedAt: Record<string, number>;
  /** Lit les nombres qui manquent ou ont vieilli ; `force` relit tout. */
  load: (bentoIds: readonly string[], options?: { force?: boolean }) => Promise<void>;
  /** Le cœur touché. Rend l'erreur, que l'écran dit, après avoir défait. */
  toggleLike: (bentoId: string) => Promise<{ error?: unknown }>;
  /** Un commentaire écrit ou supprimé. */
  bumpComments: (bentoId: string, delta: number) => void;
  /**
   * Relit tous les nombres déjà lus, sans rien vider : après un blocage, un
   * déblocage ou un réglage, les barres montées gardent leur place et se
   * mettent à jour. Vider le cache les laissait vides jusqu'au prochain
   * montage (recette du lot 5).
   */
  refreshAll: () => Promise<void>;
  /** Un autre compte sur ce téléphone (chantier 28) : ses cœurs ne sont pas les siens. */
  reset: () => void;
};

/** Le dernier toucher de chaque cœur : une réponse plus ancienne ne l'écrase pas. */
const likeSeq = new Map<string, number>();

export const useSocial = create<SocialState>((set, get) => ({
  byId: {},
  loadedAt: {},

  load: async (bentoIds, options) => {
    const now = Date.now();
    const { loadedAt } = get();
    const wanted = [...new Set(bentoIds)].filter(
      (id) => options?.force || !loadedAt[id] || now - loadedAt[id] > FRESH_MS,
    );
    if (wanted.length === 0) return;
    // Marqués d'avance : deux listes qui montrent le même bento ne le
    // demandent pas deux fois.
    set((s) => ({ loadedAt: { ...s.loadedAt, ...Object.fromEntries(wanted.map((id) => [id, now])) } }));
    try {
      const rows = await fetchBentoSocial(supabase, wanted);
      set((s) => {
        const byId = { ...s.byId };
        for (const [id, social] of rows) {
          // Un cœur en vol garde son état d'avance.
          if (!likeSeq.has(id)) byId[id] = social;
        }
        return { byId };
      });
    } catch (e) {
      console.warn('[social] nombres', e);
      // Relus à la prochaine demande.
      set((s) => {
        const next = { ...s.loadedAt };
        for (const id of wanted) delete next[id];
        return { loadedAt: next };
      });
    }
  },

  toggleLike: async (bentoId) => {
    const before = get().byId[bentoId];
    if (!before || before.likes === null) return {};
    const optimistic = withLikeToggled(before);
    const seq = (likeSeq.get(bentoId) ?? 0) + 1;
    likeSeq.set(bentoId, seq);
    set((s) => ({ byId: { ...s.byId, [bentoId]: optimistic } }));
    try {
      const confirmed = await setLike(supabase, bentoId, optimistic.liked);
      if (likeSeq.get(bentoId) === seq) {
        likeSeq.delete(bentoId);
        set((s) => ({
          byId: { ...s.byId, [bentoId]: { ...(s.byId[bentoId] ?? optimistic), ...confirmed } },
        }));
      }
      return {};
    } catch (error) {
      if (likeSeq.get(bentoId) === seq) {
        likeSeq.delete(bentoId);
        set((s) => ({ byId: { ...s.byId, [bentoId]: before } }));
      }
      return { error };
    }
  },

  bumpComments: (bentoId, delta) => {
    const current = get().byId[bentoId];
    if (!current) return;
    set((s) => ({ byId: { ...s.byId, [bentoId]: withCommentDelta(current, delta) } }));
  },

  refreshAll: async () => {
    await get().load(Object.keys(get().byId), { force: true });
  },

  reset: () => {
    likeSeq.clear();
    set({ byId: {}, loadedAt: {} });
  },
}));

/**
 * Les bentos que les barres montées demandent, lus d'un seul appel : un
 * écran qui monte dix posts fait une requête, pas dix.
 */
const queued = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export function requestSocial(bentoId: string) {
  queued.add(bentoId);
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    const ids = [...queued];
    queued.clear();
    void useSocial.getState().load(ids);
  }, 50);
}
