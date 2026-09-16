import { MAIN_CASES, type CaseMeta } from '@bento-pop/supabase-mobile/bento';
import type { CategoryKey } from '@bento-pop/supabase-mobile/types';
import type { BentoSlots, BentoTile } from '@/lib/bento/map';

/**
 * Une case de la boîte, telle que la page publique la dessine.
 *
 * Pendant web de `apps/mobile/src/components/bento/cases.ts`, et pour la même
 * raison : une édition n'a pas de catégories, elle a des cases ordonnées dont
 * deux peuvent porter le même type. `BentoSlots`, indexé par catégorie, ne
 * peut pas la représenter.
 */
export type PublicCase = CaseMeta & { readonly tile?: BentoTile };

/**
 * Les six cases du bento principal, remplies depuis la requête publique.
 *
 * L'ordre est celui de `CATEGORY_ORDER`, donc celui de la boîte, et les
 * intitulés viennent des mêmes constantes que l'app : la page web et
 * l'application affichent le même mot sur la même case.
 */
export function mainBentoCases(slots: BentoSlots): readonly PublicCase[] {
  return MAIN_CASES.map((meta) => ({
    ...meta,
    tile: slots[meta.key as CategoryKey],
  }));
}

/**
 * Les cases d'un bento, remplies depuis sa requête.
 *
 * La variante générale : `cases` vient de la base, six pour le bento
 * principal et de deux à six pour une édition, et `slots` porte ce qui y est
 * posé. `mainBentoCases` reste pour les écrans qui n'ont pas de bento sous la
 * main, comme la page « pas encore terminé ».
 */
export function publicCases(
  cases: readonly CaseMeta[],
  slots: BentoSlots,
): readonly PublicCase[] {
  return cases.map((meta) => ({ ...meta, tile: slots[meta.key] }));
}
