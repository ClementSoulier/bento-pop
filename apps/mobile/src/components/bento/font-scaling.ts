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

/*
 * Les trois autres plafonds de l'app (chantier 11, `docs/UX-11-ACCESSIBILITE-POLISH.md`
 * §5.1). Tout texte de l'app en porte un, ou fige sa police : c'est ce que vérifie
 * `font-scaling.test.ts`, sur tous les fichiers.
 *
 * Sans eux, à la plus grande taille d'accessibilité d'iOS, l'accueil d'un
 * iPhone 17 Pro poussait son bouton hors de l'écran, sans défilement pour le
 * rattraper : on ne pouvait plus s'inscrire.
 */

/** Textes de lecture, champs, lignes de liste : ce qui peut passer à la ligne. */
export const CONTENT_MAX_FONT_MULTIPLIER = 1.4;

/**
 * Libellés de boutons, puces, onglets, étiquettes posées dans une hauteur fixe :
 * ce qui décide d'une hauteur. 1,2 et non 1,4, mesuré au chantier 7 : à la plus
 * grande taille, la rangée de boutons de la page publique recouvrait l'écran.
 */
export const CONTROL_MAX_FONT_MULTIPLIER = 1.2;

/**
 * Titres en Extenda. Une police de 28 à 56 pt n'a pas besoin de grossir autant
 * qu'un texte de 13 pt pour se lire, et chaque point de plus y coûte une ligne :
 * « COMPOS / E » dès xxLarge sur l'accueil d'un 17 Pro.
 */
export const TITLE_MAX_FONT_MULTIPLIER = 1.2;

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

/**
 * Taille et hauteur de ligne d'un texte qui applique lui-même la police système,
 * plafonnée : à poser avec `allowFontScaling={false}`, cf. `fontScaleFor`.
 */
export function scaledType(
  fontScale: number,
  maxFontSizeMultiplier: number,
  fontSize: number,
  lineHeight: number,
): { fontSize: number; lineHeight: number } {
  const scale = fontScaleFor(fontScale, maxFontSizeMultiplier);
  return { fontSize: fontSize * scale, lineHeight: lineHeight * scale };
}

/**
 * Hauteur de ligne qu'iOS donne à une police quand on ne la pose pas, en em :
 * ascendante moins descendante plus interligne, table `hhea`.
 *
 * Android ne prend pas cette table : avec `includeFontPadding`, sa valeur par
 * défaut, il réserve `usWinAscent` et `usWinDescent` de la table `OS/2`, soit
 * 2,574 em pour Bungee. Mesuré sur l'émulateur Pixel 8 : le libellé de 15 pt d'un
 * `StampButton` y occupait 39 dp, 20 sur iOS, et le bouton 73 dp au lieu de 54.
 * Poser cette hauteur, avec `includeFontPadding: false`, rend la même boîte sur
 * les deux plateformes.
 */
export const NATURAL_LINE_EM = {
  /** `hhea` 1020 / −300 / 0, sur 1000 unités par em. */
  Bungee: 1.32,
  /** `hhea` 974 / −236 / 0. */
  Fredoka: 1.21,
} as const;

/**
 * La hauteur de ligne naturelle d'iOS, arrondie comme iOS l'arrondit : au tiers
 * de point supérieur. Bungee 10 donne 13,33, Bungee 15 donne 20, relevés dans
 * l'arbre d'accessibilité de l'iPhone 17 Pro.
 */
export function naturalLineHeight(font: keyof typeof NATURAL_LINE_EM, fontSize: number): number {
  // Le centième retiré absorbe l'erreur de virgule flottante d'un produit exact.
  return Math.ceil(fontSize * NATURAL_LINE_EM[font] * 3 - 0.01) / 3;
}
