import { feedScale } from '@/components/feed/layout';
import { GRID_WIDTH, gridBoxHeight, gridScaleForHeight } from './geometry';

/**
 * Budget vertical de la page bento publique, `app/u/[pseudo].tsx`.
 *
 * La règle du chantier 7 : la boîte a les mêmes proportions et la même taille
 * que dans le fil, et rien ne la recouvre. Le fil calcule son échelle sur la
 * largeur (`feed/layout.ts`) ; cette page reprend ce calcul et lui ajoute la
 * seule contrainte que le fil n'a pas : elle tient en un écran, donc la
 * hauteur plafonne aussi.
 *
 * Ce module remplace un `scale={0.94}` écrit en dur, passé à une grille qui ne
 * met à l'échelle que ses hauteurs. Mesuré le 14 septembre 2026 : la boîte
 * écrasée de 8 % sur un iPhone 17 Pro, et sur un iPhone SE 118 pt de boîte
 * sous les boutons, dont 35 hors de l'écran, sans rien pour défiler.
 *
 * Aucun import de `react-native`, sur le modèle de `compose-layout.ts` : le
 * module reste chargeable sous `node:test`.
 *
 * Cf. `docs/UX-07-PAGE-BENTO-PUBLIQUE-MOBILE.md` §5.1.
 */

/**
 * Cotes de l'écran que le modèle additionne.
 *
 * L'écran les importe pour ses styles au lieu de les recopier : c'est ce qui
 * empêche le modèle de dériver du rendu. Une marge retouchée dans le JSX seul
 * ferait mentir l'échelle sans que rien ne casse.
 */
export const PUBLIC_TOP_BAR = { paddingTop: 8, buttonSize: 36 } as const;

/**
 * `paddingTop` 12 et `paddingBottom` 10, au lieu des 20 et 14 d'avant le
 * chantier : sans ce rabot de 12 pt, la boîte serait plus petite que celle du
 * fil sur 17 Pro et 17e.
 */
export const PUBLIC_HEADER = {
  paddingTop: 12,
  avatarSize: 70,
  pseudoMarginTop: 8,
  dateMarginTop: 4,
  paddingBottom: 10,
} as const;

export const PUBLIC_CTA = {
  padding: 16,
  paddingBottom: 32,
  borderWidth: 3,
  paddingVertical: 14,
} as const;

/** Barre du haut, à taille fixe : `paddingTop` 8 + bouton retour de 36. */
export const TOP_BAR_H = PUBLIC_TOP_BAR.paddingTop + PUBLIC_TOP_BAR.buttonSize;

/** En-tête, hors lignes de texte : 12 + avatar 70 + 8 + 4 + 10. */
export const HEADER_FIXED_H =
  PUBLIC_HEADER.paddingTop +
  PUBLIC_HEADER.avatarSize +
  PUBLIC_HEADER.pseudoMarginTop +
  PUBLIC_HEADER.dateMarginTop +
  PUBLIC_HEADER.paddingBottom;

/**
 * Ligne du pseudo, Extenda 24, à la taille de police par défaut. Mesurée, et
 * posée en `lineHeight` par l'écran : la hauteur ne dépend plus des métriques
 * de la police.
 */
export const PSEUDO_LINE_H = 24;

/** Ligne de date, 13 pt système, à la taille par défaut. Mesurée, posée de même. */
export const DATE_LINE_H = 16;

/**
 * Bloc des boutons collants, hors libellé : `padding` 16 + bordures 3 × 2 +
 * `paddingVertical` 14 × 2 + `paddingBottom` 32.
 *
 * Compté depuis le **haut du bloc**, 16 pt au-dessus des boutons : c'est là
 * que commence le dégradé, et le contenu qui défile doit s'y fondre avant
 * d'atteindre un bouton.
 */
export const CTA_FIXED_H =
  PUBLIC_CTA.padding +
  PUBLIC_CTA.borderWidth * 2 +
  PUBLIC_CTA.paddingVertical * 2 +
  PUBLIC_CTA.paddingBottom;

/** Libellé d'un bouton, Bungee 13, à la taille par défaut : 51 − 34. Mesuré, posé de même. */
export const CTA_LABEL_LINE_H = 17;

/** Écart minimal entre le bas de la boîte et le haut du bloc de boutons. */
export const CTA_GAP = 8;

/**
 * Plafonds de grossissement de la police système, à poser tels quels en
 * `maxFontSizeMultiplier` sur les textes de l'écran (spéc §5.4).
 *
 * Le modèle ne tient que si l'écran les applique : ce sont eux qui bornent la
 * croissance de l'en-tête et des boutons. Les libellés de boutons plafonnent
 * plus bas parce qu'ils décident d'une hauteur, dans un bloc collant qui
 * recouvrait l'écran entier à la plus grande taille.
 */
export const CONTENT_MAX_FONT_MULTIPLIER = 1.4;
export const BUTTON_MAX_FONT_MULTIPLIER = 1.2;

/**
 * Plancher d'échelle : exactement ce que le fil montre sur un iPhone SE,
 * 375 pt, livré et accepté au chantier 2. En dessous, la page montrerait le
 * bento plus petit que le fil sur le même écran, alors qu'il y est seul.
 *
 * `feedScale(375)`, soit 0,8615, et non 0,86 : l'arrondi aurait rendu la
 * boîte du SE 0,5 pt plus étroite que celle du fil.
 *
 * Un plancher, pas une garantie : sur une fenêtre plus étroite que le SE,
 * 360 dp sur beaucoup d'Android, la largeur l'emporte et la boîte descend
 * avec celle du fil. Elle n'est jamais plus petite que dans le fil.
 */
export const MIN_SCALE = feedScale(375);

export type PublicLayoutMetrics = {
  /** Fenêtre en points, `useWindowDimensions()`. */
  width: number;
  height: number;
  /** `useSafeAreaInsets()`. */
  insetTop: number;
  insetBottom: number;
  /**
   * `useWindowDimensions().fontScale`.
   *
   * Obligatoire : l'en-tête grossit avec la police système, et un modèle qui
   * l'ignore laisse la boîte passer sous les boutons dès les tailles
   * au-dessus du défaut.
   */
  fontScale: number;
};

/** Multiplicateur que React Native applique réellement à un texte plafonné. */
function appliedFontScale(fontScale: number, max: number): number {
  // Une valeur absurde se lit comme la taille par défaut, pas comme un
  // en-tête de hauteur nulle.
  if (!Number.isFinite(fontScale) || fontScale <= 0) return 1;
  return Math.min(fontScale, max);
}

/**
 * Hauteur de l'en-tête à une taille de police donnée.
 *
 * Suppose une ligne pour le pseudo et une pour la date : l'écran doit poser
 * `numberOfLines={1}` sur les deux. Sans ça, `@bento_pop_culture`, le plus
 * long pseudo publié, passe sur deux lignes dès la taille xxLarge sur un
 * iPhone SE, et le modèle ment de toute une ligne.
 */
export function publicHeaderHeight(fontScale: number): number {
  const lines = PSEUDO_LINE_H + DATE_LINE_H;
  return HEADER_FIXED_H + lines * appliedFontScale(fontScale, CONTENT_MAX_FONT_MULTIPLIER);
}

/** Hauteur du bloc de boutons collants à une taille de police donnée. */
export function publicCtaBlockHeight(fontScale: number): number {
  return CTA_FIXED_H + CTA_LABEL_LINE_H * appliedFontScale(fontScale, BUTTON_MAX_FONT_MULTIPLIER);
}

/**
 * Place à réserver sous la boîte dans le contenu défilant : le bloc de
 * boutons, qui flotte par-dessus, et l'écart.
 */
export function publicScrollBottomInset(fontScale: number): number {
  return publicCtaBlockHeight(fontScale) + CTA_GAP;
}

/** Hauteur laissée à la boîte une fois la barre, l'en-tête et les boutons servis. */
export function publicBoxAvailableHeight(metrics: PublicLayoutMetrics): number {
  return (
    metrics.height -
    metrics.insetTop -
    metrics.insetBottom -
    TOP_BAR_H -
    publicHeaderHeight(metrics.fontScale) -
    publicScrollBottomInset(metrics.fontScale)
  );
}

/**
 * Échelle de la boîte. Trois contraintes, dans cet ordre de priorité :
 *
 * 1. jamais plus grande que dans le fil : `feedScale` est un plafond ;
 * 2. jamais recouverte : la hauteur disponible en est un autre ;
 * 3. jamais illisible : `MIN_SCALE` est un plancher, et c'est lui qui décide
 *    quand la page défile.
 */
export function publicBentoScale(metrics: PublicLayoutMetrics): number {
  const byWidth = feedScale(metrics.width);
  const byHeight = gridScaleForHeight(publicBoxAvailableHeight(metrics));
  return Math.min(byWidth, Math.max(byHeight, MIN_SCALE));
}

/**
 * Marge horizontale de la boîte, de chaque côté.
 *
 * Une marge et non une largeur, pour la raison écrite dans `feedSideInset` :
 * sur iOS, une largeur posée sur un enfant étiré par son parent ne tient pas.
 */
export function publicSideInset(width: number, scale: number): number {
  return Math.max(0, (width - GRID_WIDTH * scale) / 2);
}

/**
 * Ce qui dépasse de l'écran et se rattrape en défilant. Nul partout où le
 * plancher ne mord pas.
 */
export function publicScrollOverflow(metrics: PublicLayoutMetrics): number {
  return Math.max(0, gridBoxHeight(publicBentoScale(metrics)) - publicBoxAvailableHeight(metrics));
}
