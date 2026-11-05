/**
 * Où faire défiler la bande des puces pour que la puce active se voie en entier,
 * ou `null` si elle se voit déjà.
 *
 * - une puce déjà visible en entier ne fait rien bouger ;
 * - une puce qui tient dans le premier écran ramène la bande au début : « Mon
 *   bento » y est, et c'est le chemin du retour ;
 * - sinon, le moins de mouvement possible : coupée à gauche, elle se cale à
 *   gauche, coupée à droite, à droite.
 *
 * La recette du 16 septembre 2026 l'a rendu nécessaire. Taper une édition au bout
 * de la bande crée son bento, qui prend place juste après « Mon bento » : la bande
 * restait défilée à droite, la puce active hors de l'écran, et plus rien ne disait
 * quel bento on éditait.
 *
 * Aucun import de `react-native` : testé sous `node:test`.
 */
export function selectorRevealOffset({
  x,
  width,
  offset,
  viewport,
}: {
  /** Position de la puce dans le contenu de la bande. */
  x: number;
  width: number;
  /** Défilement actuel de la bande. */
  offset: number;
  /** Largeur visible de la bande. Zéro tant qu'elle n'est pas mesurée. */
  viewport: number;
}): number | null {
  if (viewport <= 0) return null;
  const end = x + width;
  if (x >= offset && end <= offset + viewport) return null;
  if (end <= viewport) return 0;
  if (x < offset) return x;
  return end - viewport;
}
