import { GRID_HEIGHT, GRID_WIDTH } from '@/components/bento/geometry';

/**
 * Géométrie du fil « La table ». Pur, donc testable dans node.
 *
 * L'échelle se calcule sur la **largeur**, parce qu'un fil défile
 * verticalement : la largeur est la seule contrainte. C'est l'inverse du
 * composer, qui calcule sur la hauteur disponible parce qu'il tient en un
 * écran. Les deux sont corrects, la différence est notée ici pour qu'on ne
 * « corrige » pas l'un avec l'autre.
 */

/** Largeur de référence du design, 361 pt. */
export const DESIGN_WIDTH = GRID_WIDTH;

/** Hauteur de la boîte à l'échelle 1, 512 pt. */
export const DESIGN_HEIGHT = GRID_HEIGHT;

/** Marge latérale de l'écran, de chaque côté. */
export const H_PADDING = 16;

/**
 * Au-delà, sur tablette, la boîte s'étalerait jusqu'à des cases plus grandes
 * que l'écran d'un téléphone, et le fil perdrait son unité.
 */
export const MAX_BOX_WIDTH = 420;

/**
 * Plancher défensif. `useWindowDimensions` peut rendre 0 sur la toute
 * première frame de certaines plateformes, ce qui produirait une échelle
 * négative et une grille inversée.
 */
export const MIN_BOX_WIDTH = 240;

/** Écart entre l'étiquette d'identité et la boîte. */
export const HEADER_GAP = 10;

/** Écart entre deux posts. */
export const POST_GAP = 28;

/**
 * Débordement de l'étiquette « coup de cœur » sur le coin supérieur droit de
 * la boîte. Les valeurs sont négatives, donc l'étiquette sort du cadre ; la
 * place vient de `H_PADDING`, qui laisse 16 pt de chaque côté.
 */
export const RIBBON_OFFSET = { top: -8, right: -6 } as const;

/**
 * Barre d'actions (likes, commentaires) : rien en v1.
 *
 * Une rangée cœur / bulle grisée annoncerait une fonctionnalité inexistante
 * et récolterait des taps sans réponse. La constante existe pour que le
 * chantier 8 soit un changement de valeur et pas une reprise de la mise en
 * page.
 */
export const ACTIONS_HEIGHT = 0;

/** Largeur de la boîte pour une largeur de fenêtre donnée. */
export function feedBoxWidth(windowWidth: number): number {
  const available = windowWidth - H_PADDING * 2;
  return Math.max(MIN_BOX_WIDTH, Math.min(available, MAX_BOX_WIDTH));
}

/** Échelle à passer à `BentoGrid` pour une largeur de fenêtre donnée. */
export function feedScale(windowWidth: number): number {
  return feedBoxWidth(windowWidth) / DESIGN_WIDTH;
}
