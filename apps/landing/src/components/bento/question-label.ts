import {
  boxTileWidth,
  bungeeTextWidth,
  fitLabel,
  type LabelFit,
} from '@bento-pop/supabase-mobile/bento';
import { extendaTextWidth } from '@bento-pop/supabase-mobile/extenda';
import { CASES_PAR_RANGEE, TILE, TILE_TYPO, type TileSize } from './layout';

/**
 * La question d'une édition dans l'étiquette d'une case remplie, pour les deux
 * rendus de la landing : la page publique et l'aperçu de lien 1200 × 630.
 *
 * Proposition A, validée le 17 septembre 2026 : là où le bento principal écrit
 * « FILM », une case d'édition écrit sa question. Même calcul que l'app,
 * `fitLabel`, chacun avec sa police et sa géométrie.
 *
 * Pure, sans React ni `next` : testée sous `node:test`.
 */

/** Marge horizontale de l'étiquette d'une question, comme dans l'app. */
export const QUESTION_PADDING_H = 4;

/** Marge verticale de l'étiquette. */
export const QUESTION_PADDING_V = 2;

/**
 * Marge ajoutée à la plus longue ligne pour dessiner le fond : le rendu du
 * navigateur ou de satori peut dépasser la mesure d'un cheveu, et une ligne
 * qui ne tient plus dans son fond passerait à la ligne.
 */
export function labelBoxTextWidth(fit: LabelFit, textWidth: number): number {
  return fit.truncated ? textWidth : Math.min(textWidth, Math.ceil(fit.widest * 1.02 + 1));
}

/**
 * Page publique, en unités de design : la boîte se met à l'échelle en unités
 * de conteneur, donc la coupe calculée ici vaut à toute largeur d'écran.
 *
 * Bungee et un interlettrage de 1, ceux de l'app : c'est la même étiquette.
 */
export function webQuestionLabel(question: string, size: TileSize) {
  const typo = TILE_TYPO[size];
  const textWidth =
    boxTileWidth(CASES_PAR_RANGEE[size]) - TILE.border * 2 - typo.padding * 2 - QUESTION_PADDING_H * 2;
  const fit = fitLabel(question, textWidth, typo.stamp, {
    measure: (line, fontSize) => bungeeTextWidth(line, fontSize, 1),
  });
  return { fit, textWidth, boxTextWidth: labelBoxTextWidth(fit, textWidth) };
}

/**
 * Aperçu de lien, en pixels : la boîte y est dessinée à l'échelle `scale`, et
 * satori n'y embarque qu'Extenda. `round` reproduit l'arrondi de ses
 * dimensions, deux décimales.
 */
export function ogQuestionLabel(
  question: string,
  size: TileSize,
  scale: number,
  round: (n: number) => number,
) {
  const typo = TILE_TYPO[size];
  const tileWidth = boxTileWidth(CASES_PAR_RANGEE[size]) * scale;
  const textWidth =
    tileWidth - round(TILE.border) * 2 - round(typo.padding) * 2 - round(QUESTION_PADDING_H) * 2;
  const fit = fitLabel(question, textWidth, round(typo.stamp + 1), {
    measure: (line, fontSize) => extendaTextWidth(line, fontSize, 0.6),
  });
  return { fit, textWidth, boxTextWidth: labelBoxTextWidth(fit, textWidth) };
}
