import { MAIN_CASES, type CaseMeta } from '@bento-pop/supabase-mobile/bento';
import type { CategoryKey } from '@/supabase/types';
import type { TileData } from './Tile';

/**
 * Une case de la boîte, telle que la grille la dessine.
 *
 * Déclarée ici plutôt que dans `BentoGrid.tsx` pour que l'adaptateur
 * ci-dessous n'ait pas à importer le composant : une bibliothèque qui importe
 * un écran et un écran qui importe la bibliothèque, c'est le cycle que Metro
 * a signalé au chantier 16, invisible du typecheck et des tests.
 */
export type BentoCase = CaseMeta & { readonly tile?: TileData };

/**
 * Les cases du bento principal, indexées par catégorie.
 *
 * Reste juste pour lui, et pour lui seul : ses six cases sont fixes et
 * portent chacune une catégorie distincte. C'est le type que le fil, la page
 * publique et l'image de partage manipulent ; `mainBentoCases` le convertit
 * en liste ordonnée au moment de dessiner.
 */
export type BentoItems = Partial<Record<CategoryKey, TileData>>;

/**
 * Les six cases du bento principal, remplies depuis le store.
 *
 * L'adaptateur qui laisse les écrans inchangés. Ils tiennent leurs cases dans
 * un dictionnaire indexé par catégorie, ce qui reste juste pour le bento
 * principal et ses six cases fixes ; la grille, elle, prend une liste
 * ordonnée depuis le chantier 13, parce qu'une édition peut porter deux cases
 * du même type. Une seule fonction fait le pont.
 *
 * L'ordre est celui de `CATEGORY_ORDER`, donc celui de la boîte.
 */
export function mainBentoCases(slots: BentoItems): readonly BentoCase[] {
  return MAIN_CASES.map((meta) => ({
    ...meta,
    tile: slots[meta.key as CategoryKey],
  }));
}

/**
 * Les cases du bento édité, remplies depuis le store.
 *
 * La variante du composer, qui ne connaît pas ses cases à la compilation :
 * elles viennent du store, six pour le bento principal et de deux à six pour
 * une édition. `mainBentoCases` reste pour le fil, la page publique et
 * l'image de partage, qui ne montrent que le bento principal jusqu'au lot 5.
 */
export function composerCases(
  cases: readonly CaseMeta[],
  slots: Partial<Record<string, TileData>>,
): readonly BentoCase[] {
  return cases.map((meta) => ({ ...meta, tile: slots[meta.key] }));
}
