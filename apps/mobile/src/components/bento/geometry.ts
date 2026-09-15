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

/**
 * Part de la hauteur qui se met à l'échelle linéairement : rangées, écarts et
 * marge intérieure. Vaut 502. Le cadre est compté à part, parce qu'il
 * s'arrondit.
 */
export const GRID_SCALABLE_HEIGHT = GRID_HEIGHT - GRID_GEOMETRY.BORDER * 2;

/**
 * Épaisseur du cadre à une échelle donnée, telle que `BentoGrid` la rend :
 * arrondie au point, jamais sous 3.
 *
 * C'est ce qui empêche la boîte de mesurer `512 × échelle`. Le cadre vaut 5
 * de 0,9 à 1,1, mais 4 à l'échelle du fil sur iPhone SE : la boîte y fait
 * 440,5 pt et non 441,1, quand celle d'un 17 Pro fait 480,0 et non 479,4.
 * Moins d'un point, dans un sens ou dans l'autre, mais c'est précisément la
 * marge d'un bouton collant.
 */
export function gridBorderWidth(scale: number, borderWidth: number = GRID_GEOMETRY.BORDER): number {
  return Math.max(3, Math.round(borderWidth * scale));
}

/**
 * Largeur d'une case dans une boîte de largeur donnée, cadre de la boîte
 * compris : la boîte moins son cadre et sa marge intérieure, partagée entre
 * les cases de la rangée et leurs écarts. Le film est seul sur la sienne,
 * série et artiste sont deux, les trois dernières trois.
 *
 * La boîte ne mesure pas toujours `GRID_WIDTH × scale` : le composer calcule
 * son échelle sur la hauteur et garde toute la largeur de l'écran, et l'image
 * de partage étire la sienne sur ses 920 pt.
 */
export function gridTileWidth(
  boxWidth: number,
  scale: number,
  tilesInRow: 1 | 2 | 3,
  borderWidth: number = GRID_GEOMETRY.BORDER,
): number {
  const inner = boxWidth - gridBorderWidth(scale, borderWidth) * 2 - GRID_GEOMETRY.PAD * scale * 2;
  return (inner - GRID_GEOMETRY.GAP * scale * (tilesInRow - 1)) / tilesInRow;
}

/** Hauteur rendue de la boîte à une échelle donnée, cadre compris. */
export function gridBoxHeight(scale: number, borderWidth: number = GRID_GEOMETRY.BORDER): number {
  return GRID_SCALABLE_HEIGHT * scale + gridBorderWidth(scale, borderWidth) * 2;
}

/**
 * La plus grande échelle dont la boîte tient dans `height`.
 *
 * L'inverse exact de `gridBoxHeight`, qui n'est pas linéaire : l'épaisseur du
 * cadre saute d'un point à chaque seuil d'arrondi. On essaie donc chaque
 * épaisseur possible, en bornant l'échelle au seuil où l'arrondi passerait à
 * la suivante, et on garde la plus grande.
 *
 * Renvoie 0 quand rien ne tient, par exemple sur la première frame de
 * certaines plateformes où la fenêtre mesure 0 : le plancher appartient à
 * l'appelant.
 */
export function gridScaleForHeight(
  height: number,
  borderWidth: number = GRID_GEOMETRY.BORDER,
): number {
  // Aucune échelle qui tient ne dépasse `height / 502`, donc aucun cadre ne
  // dépasse celui de cette échelle-là.
  const thickest = gridBorderWidth(Math.max(0, height) / GRID_SCALABLE_HEIGHT, borderWidth);
  let best = 0;
  for (let border = 3; border <= thickest; border += 1) {
    const filling = (height - border * 2) / GRID_SCALABLE_HEIGHT;
    // À `(border + 0,5) / borderWidth`, `Math.round` passe à `border + 1`.
    const threshold = (border + 0.5) / borderWidth - 1e-9;
    best = Math.max(best, Math.min(filling, threshold));
  }
  return best;
}
