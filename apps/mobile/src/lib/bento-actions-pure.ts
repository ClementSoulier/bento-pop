import type { Slots } from './bento-slots';

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
 *
 * `cases` donne la correspondance clé vers identifiant. Elle était en dur
 * avant le chantier 13, quand les six cases suffisaient ; une case d'édition
 * n'a pas de catégorie, donc son identifiant ne se devine pas. Une case dont
 * la clé n'est pas dans le jeu est écartée pour la même raison qu'une case
 * sans item : mieux vaut publier ce qui est sûr que tout perdre.
 */
export function publishItemsFromSlots(
  slots: Slots,
  cases: readonly { readonly id: number; readonly key: string }[],
): { category_id: number; item_id: string }[] {
  const parCle = new Map(cases.map((c) => [c.key, c.id]));
  return Object.entries(slots)
    .filter(([cle, tile]) => Boolean(tile?.itemId) && parCle.has(cle))
    .map(([cle, tile]) => ({ category_id: parCle.get(cle)!, item_id: tile!.itemId! }));
}
