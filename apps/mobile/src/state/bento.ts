import { create } from 'zustand';
import type { CategoryKey } from '@/supabase/types';
import type { TileData } from '@/components/bento/Tile';

/**
 * État local du bento en cours de composition / édition.
 *
 * Le store fait autorité pour l'affichage. La base fait autorité pour la
 * vérité, et `hydrate` sert à réaligner l'un sur l'autre au démarrage et à
 * chaque retour sur le composer.
 *
 * ─── Le compteur d'écritures en vol ──────────────────────────────────
 *
 * Depuis que remplir une case ferme la modale **avant** que l'écriture ne
 * soit confirmée, les deux sources se marchent dessus :
 *
 *   1. tap sur une tuile : `setSlot` optimiste, la modale se ferme ;
 *   2. le composer reprend le focus et lance `refreshProfile`, qui relit le
 *      bento en base et appelle `hydrate` ;
 *   3. l'écriture n'est pas encore arrivée, donc la base ne connaît pas
 *      encore la nouvelle case ;
 *   4. `hydrate` remplace tout le store et la case disparaît de l'écran,
 *      alors même que l'écriture va aboutir.
 *
 * `hydrate` ignore donc les données distantes tant qu'une écriture locale
 * n'est pas confirmée. La règle vit ici et pas chez l'appelant : il y a un
 * seul `hydrate` à protéger, et n'importe quel appelant futur en hérite.
 *
 * Le compteur est incrémenté / décrémenté par paires, `endWrite` dans un
 * `finally`, pour qu'une écriture qui échoue ne bloque pas la
 * resynchronisation pour le reste de la session.
 */

type BentoSlots = Partial<Record<CategoryKey, TileData & { itemId?: string }>>;

/**
 * Dernière case posée par une action de l'utilisateur.
 *
 * Sert à ne faire pulser *que* la tuile concernée sur le composer. Le
 * déclencheur vit ici et non dans l'écran parce que seul le store sait
 * distinguer un choix d'une resynchronisation : au démarrage à froid,
 * `hydrate` remplit les six cases d'un coup, et un écran qui comparerait
 * l'ancien et le nouvel état ferait pulser les six tuiles à l'ouverture.
 *
 * `seq` s'incrémente à chaque pose, y compris sur la même catégorie : sans
 * lui, remplacer deux fois de suite l'item d'une même case ne rejouerait
 * pas l'animation.
 */
type LastFilled = { cat: CategoryKey; seq: number };

type BentoState = {
  slots: BentoSlots;
  lastFilled: LastFilled | null;
  /** Écritures parties et non encore confirmées, succès ou échec. */
  pendingWrites: number;
  setSlot: (cat: CategoryKey, data: TileData & { itemId?: string }) => void;
  clearSlot: (cat: CategoryKey) => void;
  reset: () => void;
  /**
   * Remplace l'intégralité des cases par l'état distant. Sans effet tant
   * qu'une écriture locale est en vol, cf. le bloc ci-dessus.
   */
  hydrate: (slots: BentoSlots) => void;
  /** À encadrer d'un `try` / `finally` autour de toute écriture optimiste. */
  beginWrite: () => void;
  endWrite: () => void;
  filledCount: () => number;
};

export const useBento = create<BentoState>((set, get) => ({
  slots: {},
  lastFilled: null,
  pendingWrites: 0,
  setSlot: (cat, data) =>
    set((s) => ({
      slots: { ...s.slots, [cat]: data },
      lastFilled: { cat, seq: (s.lastFilled?.seq ?? 0) + 1 },
    })),
  clearSlot: (cat) =>
    set((s) => {
      const next = { ...s.slots };
      delete next[cat];
      return { slots: next };
    }),
  reset: () => set({ slots: {}, lastFilled: null, pendingWrites: 0 }),
  hydrate: (slots) => {
    if (get().pendingWrites > 0) return;
    set({ slots });
  },
  beginWrite: () => set((s) => ({ pendingWrites: s.pendingWrites + 1 })),
  // `Math.max` plutôt qu'une simple décrémentation : un `endWrite` en trop,
  // par exemple sur un chemin d'erreur remanié, rendrait le compteur négatif
  // et `hydrate` ne se rebloquerait plus jamais.
  endWrite: () => set((s) => ({ pendingWrites: Math.max(0, s.pendingWrites - 1) })),
  filledCount: () => Object.keys(get().slots).length,
}));
