import {
  ACHIEVEMENTS,
  ACHIEVEMENT_KEYS,
  achievementLabel,
  isAchievementKey,
  shownAchievements,
  type ShownAchievement,
} from '@bento-pop/supabase-mobile/bento';

/**
 * Les succès, chantier 27 : la base les pose et les date (§4) ; le catalogue,
 * leurs noms et leurs Popys sont partagés avec le web. Ici, ce que la page
 * d'un compte en fait : combien de médailles par rangée, et leur taille.
 */

export {
  ACHIEVEMENTS,
  ACHIEVEMENT_KEYS,
  achievementLabel,
  isAchievementKey,
  shownAchievements,
  type ShownAchievement,
};

/** L'écart entre deux médailles, en largeur comme en hauteur. */
export const MEDAL_GAP = 10;

/** Le cercle d'une médaille, à l'échelle 1. */
export const MEDAL_CIRCLE = 56;

/**
 * Le nom le plus large d'un seul mot, « Inconditionnel », en gras à 12 pt :
 * 88 pt mesurés au pixel au 17 Pro. Un mot plus large que sa médaille se
 * couperait au milieu, sur iOS : la recette l'a vu au SE, « Inconditionn »
 * puis « el », dans une médaille de 84 pt.
 */
export const LONGEST_WORD_WIDTH = 88;

/** La largeur d'une médaille, à l'échelle 1 : ce nom, et 4 pt de marge. */
const MEDAL_MIN_WIDTH = LONGEST_WORD_WIDTH + 4;

/**
 * La grille des médailles dans une largeur donnée : quatre par rangée au plus,
 * deux au moins, moins quand le texte agrandi ne tiendrait plus (D12). Les
 * médailles se partagent la rangée, au point près.
 */
export function medalGrid(width: number, textScale: number): { columns: number; medalWidth: number } {
  const scale = Math.max(textScale, 1);
  const fits = Math.floor((width + MEDAL_GAP) / (MEDAL_MIN_WIDTH * scale + MEDAL_GAP));
  const columns = Math.min(4, Math.max(2, fits));
  return { columns, medalWidth: Math.floor((width - MEDAL_GAP * (columns - 1)) / columns) };
}
