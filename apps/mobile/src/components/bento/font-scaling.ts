/**
 * Plafonds de la police système, et ce qu'il faut pour qu'ils tiennent.
 *
 * Aucun import de `react-native` : le modèle de la page publique et le test
 * des plafonds lisent ce module sous `node:test`.
 */

/**
 * Plafond de grossissement dans les cases du bento, `Tile` et `EmptyTile` : le
 * fil, le composer, la page publique et l'écran de mécanique les partagent.
 *
 * Une case a la hauteur que la grille lui donne. Ses textes ne peuvent pas la
 * faire grandir, seulement déborder : sans plafond, à la plus grande taille
 * système, le titre recouvrait la case et l'étiquette « SÉRIE » passait sur le
 * titre. 1,2 et non 1,4, mesuré à la plus grande taille (chantier 7, lot 3) :
 * à 1,4, l'étiquette « SON » touchait le titre sur un iPhone SE, et iOS
 * coupait « MERRY / -GO- » sur un 17 Pro. C'est aussi le plafond des libellés
 * de boutons de la page publique, pour la même raison : un texte dans une
 * hauteur qu'il ne décide pas. Là où la case est trop basse pour l'atteindre,
 * dans le composer d'un petit téléphone, son texte grossit moins : cf.
 * `tileTextScale`.
 *
 * L'image de partage ne suit pas du tout la police système : elle passe
 * `allowFontScaling={false}` à la grille, cf. `ShareImage`.
 */
export const TILE_MAX_FONT_MULTIPLIER = 1.2;

/**
 * Facteur de police qu'un texte applique lui-même : la taille système,
 * plafonnée.
 *
 * `maxFontSizeMultiplier` suffit à un texte dont seule la taille compte. Il ne
 * suffit pas dès que la hauteur de ligne compte, sur Android, pour deux
 * raisons mesurées sur l'émulateur Pixel 8 à la taille 2,0 (chantier 7,
 * lot 3) :
 *
 * - React Native 0.86 plafonne la police mais pas `lineHeight`, converti par
 *   `toPixelFromSP(value)` sans plafond dans `TextAttributeProps.kt`. Les lignes
 *   d'un titre de case s'y écartaient jusqu'à l'étiquette, et l'en-tête de la
 *   page publique dépassait le modèle de 8,6 dp ;
 * - la conversion suit la courbe non linéaire d'Android 14 : 24 y devient 36,
 *   16 devient 28. Diviser la valeur posée par la taille système ne rattrape
 *   donc que les petites : le pseudo restait à 28,95 dp pour 33,6.
 *
 * Ces textes passent `allowFontScaling={false}` et multiplient eux-mêmes leur
 * taille et leur hauteur de ligne par ce facteur, le même que celui du modèle :
 * le rendu est celui du calcul, sur les deux plateformes.
 */
export function fontScaleFor(fontScale: number, maxFontSizeMultiplier: number): number {
  // Une valeur absurde se lit comme la taille par défaut.
  if (!Number.isFinite(fontScale) || fontScale <= 0) return 1;
  return Math.min(fontScale, maxFontSizeMultiplier);
}
