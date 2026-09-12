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
 * Aucun import de `react-native` : le module reste chargeable sous
 * `node:test`.
 */

/** Logo 24 + `paddingTop` 8 + `marginBottom` 14. */
export const TOP_BAR_H = 46;
/** Pseudo, titre, barre de progression et leurs marges. */
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
 * Écart minimal entre la boîte et le bouton.
 *
 * Retiré de la hauteur disponible avant de calculer l'échelle, *et* posé en
 * marge sur le bouton : le premier empêche la boîte de réclamer cet espace,
 * le second le garantit si le calcul dérive.
 */
export const CTA_GAP = 56;

/** Bornes de l'échelle : en dessous de 0,65 les tampons deviennent illisibles. */
export const MIN_SCALE = 0.65;
export const MAX_SCALE = 1;

export type ComposeMetrics = {
  screenHeight: number;
  insetTop: number;
  tabBarHeight: number;
};

/** Hauteur laissée à la grille une fois tout le reste servi. */
export function composeAvailableHeight({
  screenHeight,
  insetTop,
  tabBarHeight,
}: ComposeMetrics): number {
  return (
    screenHeight - insetTop - TOP_BAR_H - HEADER_H - tabBarHeight - CTA_BLOCK_H - CTA_GAP
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
 * l'échelle n'est pas plafonnée, l'écart vaut exactement `CTA_GAP` ; sur un
 * très grand écran où la grille atteint sa taille native, il le dépasse.
 * Ce qui compte est qu'il ne descende jamais en dessous.
 */
export function composeCtaGap(metrics: ComposeMetrics): number {
  const gridHeight = NATIVE_GRID_H * composeBentoScale(metrics);
  const rest =
    metrics.screenHeight -
    metrics.insetTop -
    TOP_BAR_H -
    HEADER_H -
    gridHeight -
    metrics.tabBarHeight -
    CTA_BLOCK_H;
  return Math.max(CTA_GAP, rest);
}
