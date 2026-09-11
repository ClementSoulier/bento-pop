/**
 * Géométrie de la boîte bento, à l'échelle 1.
 *
 * Extraite de `BentoGrid` pour deux raisons : le squelette de chargement du
 * fil doit reproduire exactement les mêmes proportions sans dupliquer les
 * valeurs, et ce module ne dépend pas de React Native, donc il est testable
 * dans node.
 *
 * Ce test n'est pas anecdotique. La hauteur qui en découle, **512**, est
 * recopiée en dur dans trois autres endroits qui ne se parlent pas :
 * `NATIVE_GRID_H` dans le composer, `DESIGN_HEIGHT` côté landing, et le
 * dimensionnement de l'image de partage. Modifier une hauteur de rangée ici
 * les désynchroniserait sans que rien ne casse visiblement.
 */
export const GRID_GEOMETRY = {
  /** Rangée 1 : le film, en grand. */
  H_FILM: 220,
  /** Rangée 2 : série et artiste. */
  H_MID: 134,
  /** Rangée 3 : chanson, créateur, lieu. */
  H_SM: 100,
  /** Écart entre rangées et entre cases d'une même rangée. */
  GAP: 10,
  /** Marge intérieure du cadre crème. */
  PAD: 14,
  /** Épaisseur du cadre. Le fil monte à 7 pour les coups de cœur. */
  BORDER: 5,
  /** Rayon du cadre. */
  RADIUS: 28,
  /** Rayon d'une case. */
  TILE_RADIUS: 18,
} as const;

/** Largeur de référence, celle sur laquelle le design a été composé. */
export const GRID_WIDTH = 361;

/** Hauteur totale de la boîte à l'échelle 1. Vaut 512. */
export const GRID_HEIGHT =
  GRID_GEOMETRY.PAD * 2 +
  GRID_GEOMETRY.BORDER * 2 +
  GRID_GEOMETRY.H_FILM +
  GRID_GEOMETRY.GAP +
  GRID_GEOMETRY.H_MID +
  GRID_GEOMETRY.GAP +
  GRID_GEOMETRY.H_SM;
