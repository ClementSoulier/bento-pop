import type { PopyKey } from '@bento-pop/supabase-mobile/bento';
import type { PantryColor } from './Avatar';

/**
 * La teinte du garde-manger sur laquelle chaque Popy pose l'avatar d'un
 * compte (chantier 31, D6) : aucune teinte n'est enregistrée, la Popy la
 * donne. « gene » sur `shiso`, comme la maquette ; les autres au plus près de
 * la couleur que la Popy porte déjà aux médailles et aux auteurs de
 * notifications (`POPY_ACCENTS`), « nani », turquoise, passant au vert de
 * `wasabi` pour ne pas partager `ramune` avec « intello ».
 */
export const POPY_TINTS: Readonly<Record<PopyKey, PantryColor>> = {
  content: 'yolk',
  intello: 'ramune',
  fille: 'sakura',
  gene: 'shiso',
  nani: 'wasabi',
  diable: 'ume',
};

export function popyTint(popy: PopyKey): PantryColor {
  return POPY_TINTS[popy];
}
