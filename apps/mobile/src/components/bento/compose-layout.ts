/**
 * Budget vertical du composer.
 *
 * Extrait de l'écran pour être testable : la boîte bento et le bouton
 * principal se partagent une hauteur fixe, et le calcul s'était trompé sans
 * que rien ne le signale. Mesuré sur une capture iPhone 17, bento plein :
 * **zéro point** entre la boîte et le bouton, qui se touchaient, et 93 pt de
 * jaune mort en dessous.
 *
 * La cause : `paddingBottom: tabBarHeight + 12` sur le bloc du bouton, alors
 * que la zone de contenu de l'écran exclut déjà la barre d'onglets. Elle
 * était donc comptée deux fois, et l'espace volé l'était précisément là où
 * il fallait qu'il respire.
 *
 * **La police système entre dans le budget** (chantier 11). Les textes de
 * l'en-tête et le libellé du bouton grossissaient sans que le modèle le sache :
 * sur iPhone SE, le bouton passait sous la barre d'onglets dès la taille
 * xLarge, et à la plus grande taille « MON / BENT / O » occupait la moitié de
 * l'écran. L'écran pose désormais ces hauteurs de ligne, plafonnées, et le
 * modèle les compte. Quand la grille atteint son plancher sans que tout tienne,
 * l'écran défile.
 *
 * Aucun import de `react-native` : le module reste chargeable sous
 * `node:test`.
 */

import {
  CONTROL_MAX_FONT_MULTIPLIER,
  TITLE_MAX_FONT_MULTIPLIER,
  fontScaleFor,
  naturalLineHeight,
} from './font-scaling';

/** Logo 24 + `paddingTop` 8 + `marginBottom` 14. */
export const TOP_BAR_H = 46;

/**
 * Pseudo, titre, barre de progression et leurs marges, à la taille par défaut.
 *
 * L'écran en rend 74 sur iPhone 17 Pro, mesuré dans l'arbre d'accessibilité :
 * 13,33 + 26 + 8 + 14,67 + 12. Les 14 pt d'écart sont gardés tels quels. Ils
 * sont ce qui fait tenir le bouton de l'iPhone SE à la taille par défaut, où la
 * grille est déjà au plancher, et les retirer agrandirait la boîte de tous les
 * autres téléphones.
 */
export const HEADER_H = 88;

/**
 * Bouton principal, son ombre et son `paddingBottom`.
 *
 * 66 et non 100 : la valeur héritée surestimait de 34 pt, ce qui rabotait la
 * grille d'autant et faisait diverger ce modèle du rendu réel de la même
 * quantité. Mesurée au pixel sur une capture iPhone 17, du haut de la
 * bordure noire du bouton au bas de son `paddingBottom` : 724,0 → 789,7 pt.
 */
export const CTA_BLOCK_H = 66;
/** Hauteur de la grille au repos, cf. `GRID_HEIGHT`. */
export const NATIVE_GRID_H = 512;

/**
 * Écart visé entre la boîte et le bouton.
 *
 * Retiré de la hauteur disponible avant de calculer l'échelle : la boîte ne
 * réclame pas cet espace.
 */
export const CTA_GAP = 56;

/**
 * Écart minimal, posé en marge sur le bouton : c'est lui que l'écran garantit.
 *
 * 24 et non `CTA_GAP` (chantier 11). Là où la grille est à son plancher, sur
 * iPhone SE dès la taille par défaut, les 56 pt garantis poussaient le bouton
 * jusqu'à la barre d'onglets, bordure contre bordure, puis dessous dès que la
 * police grossissait : 9 pt à xLarge, 17 à xxLarge. Le ressort au-dessus du
 * bouton rend l'écart visé partout où il y a la place ; là où il n'y en a pas,
 * l'écart se réduit jusqu'à 24, ombre de la boîte comprise, avant que l'écran ne
 * défile.
 */
export const CTA_GAP_MIN = 24;

/** Bornes de l'échelle : en dessous de 0,65 les tampons deviennent illisibles. */
export const MIN_SCALE = 0.65;
export const MAX_SCALE = 1;

/*
 * Les lignes de texte de l'en-tête, à la taille par défaut. L'écran les pose en
 * `lineHeight` et les multiplie par le facteur de leur plafond : c'est ce qui
 * les rend identiques sur iOS et Android, où Bungee prend sinon une boîte deux
 * fois plus haute.
 */

/** Pseudo, Bungee 10. */
export const PSEUDO_LINE_H = naturalLineHeight('Bungee', 10);
/** « Mon bento », Extenda 28 sur 26. */
export const TITLE_LINE_H = 26;
/**
 * Ligne d'état : « 0 / 6 » en Bungee 11, ou « En ligne » en Bungee 9 suivi
 * d'une phrase en Fredoka 12. Les deux font 14,67 sur iOS.
 */
export const STATUS_LINE_H = naturalLineHeight('Bungee', 11);

/** Libellé d'un `StampButton`, Bungee 15 : 20 pt, cf. `StampButton`. */
export const STAMP_LABEL_LINE_H = naturalLineHeight('Bungee', 15);

export type ComposeMetrics = {
  screenHeight: number;
  insetTop: number;
  tabBarHeight: number;
  /**
   * `useWindowDimensions().fontScale`. Obligatoire, pour la raison écrite en
   * tête de fichier.
   */
  fontScale: number;
  /**
   * Nombre de bentos du compte, chantier 16.
   *
   * Un seul, ou absent : la bande de sélection ne se dessine pas et la
   * géométrie ne bouge pas d'un pixel. C'est le cas de tous les comptes au 16
   * septembre 2026, et c'est la promesse du §5.4 de la spéc.
   */
  bentoCount?: number;
};

/**
 * Bande de sélection du bento, sous l'en-tête. Nulle tant qu'un compte n'a
 * qu'un bento.
 *
 * Même dessin et même raison que `publicOthersStripHeight` sur la page
 * publique : au-dessus de la boîte, pas dessous, parce que le budget vertical
 * du composer est mesuré au point et que tout ce qui suit la grille tombe
 * derrière le bloc du bouton.
 */
export function composeSelectorHeight(fontScale: number, bentoCount = 1): number {
  if (bentoCount <= 1) return 0;
  return SELECTOR_CHIP_H * fontScaleFor(fontScale, CONTROL_MAX_FONT_MULTIPLIER) + SELECTOR_GAP;
}

/** Pastille de sélection et son écart avec la boîte. */
export const SELECTOR_CHIP_H = 32;
export const SELECTOR_GAP = 10;

/** En-tête à une taille de police donnée : ce qu'il gagne s'ajoute à `HEADER_H`. */
export function composeHeaderHeight(fontScale: number): number {
  const label = fontScaleFor(fontScale, CONTROL_MAX_FONT_MULTIPLIER);
  const title = fontScaleFor(fontScale, TITLE_MAX_FONT_MULTIPLIER);
  return (
    HEADER_H +
    (PSEUDO_LINE_H + STATUS_LINE_H) * (label - 1) +
    TITLE_LINE_H * (title - 1)
  );
}

/** Bloc du bouton à une taille de police donnée. */
export function composeCtaBlockHeight(fontScale: number): number {
  return (
    CTA_BLOCK_H +
    STAMP_LABEL_LINE_H * (fontScaleFor(fontScale, CONTROL_MAX_FONT_MULTIPLIER) - 1)
  );
}

/** Hauteur laissée à la grille une fois tout le reste servi. */
export function composeAvailableHeight({
  screenHeight,
  insetTop,
  tabBarHeight,
  fontScale,
  bentoCount,
}: ComposeMetrics): number {
  return (
    screenHeight -
    insetTop -
    TOP_BAR_H -
    composeHeaderHeight(fontScale) -
    composeSelectorHeight(fontScale, bentoCount) -
    tabBarHeight -
    composeCtaBlockHeight(fontScale) -
    CTA_GAP
  );
}

/** Échelle de la grille, bornée. */
export function composeBentoScale(metrics: ComposeMetrics): number {
  const available = composeAvailableHeight(metrics);
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, available / NATIVE_GRID_H));
}

/**
 * Écart obtenu entre le bas de la boîte et le haut du bouton.
 *
 * Le ressort `flex: 1` absorbe ce que la grille n'a pas pris. Tant que
 * l'échelle n'est ni plafonnée ni au plancher, l'écart vaut exactement
 * `CTA_GAP` ; sur un très grand écran où la grille atteint sa taille native, il
 * le dépasse ; là où elle est à son plancher, il se réduit, jamais sous
 * `CTA_GAP_MIN`.
 */
export function composeCtaGap(metrics: ComposeMetrics): number {
  const gridHeight = NATIVE_GRID_H * composeBentoScale(metrics);
  const rest =
    metrics.screenHeight -
    metrics.insetTop -
    TOP_BAR_H -
    composeHeaderHeight(metrics.fontScale) -
    composeSelectorHeight(metrics.fontScale, metrics.bentoCount) -
    gridHeight -
    metrics.tabBarHeight -
    composeCtaBlockHeight(metrics.fontScale);
  return Math.max(CTA_GAP_MIN, rest);
}
