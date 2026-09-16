import { CATEGORY_IDS } from '@bento-pop/supabase-mobile/bento';
import type { Slots } from './bento-slots';
import type { CategoryKey } from '@/supabase/types';

/**
 * Le brouillon, dans la forme que `publish_first_bento` attend.
 *
 * À part de `bento-actions.ts`, qui importe les stores et le client Supabase :
 * cette conversion est pure, et un test n'a pas à monter React Native pour
 * vérifier une liste de six paires.
 *
 * Une case sans `itemId` est écartée. Ce n'est pas théorique : le composer
 * pose la case avant que l'écriture parte, donc une écriture ratée laisse une
 * case affichée sans identifiant. L'envoyer ferait échouer toute la
 * transaction sur une clé étrangère, et la personne perdrait sa publication à
 * cause d'une case qu'elle croit remplie.
 */
export function publishItemsFromSlots(
  slots: Slots,
): { category_id: number; item_id: string }[] {
  return (Object.entries(slots) as [CategoryKey, Slots[CategoryKey]][])
    .filter(([, tile]) => Boolean(tile?.itemId))
    .map(([cat, tile]) => ({ category_id: CATEGORY_IDS[cat], item_id: tile!.itemId! }));
}
