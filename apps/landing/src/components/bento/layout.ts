import type { CategoryKey } from '@bento-pop/supabase-mobile/types';

/**
 * Géométrie de la boîte bento, en « pixels de design ».
 *
 * Source unique partagée par le rendu HTML de la page publique et par le
 * rendu satori de l'image Open Graph. Les deux ne peuvent pas partager le
 * même composant — satori ne connaît ni Tailwind, ni `aspect-ratio`, ni
 * `next/image` — mais ils doivent produire exactement la même boîte.
 *
 * Les valeurs sont reprises telles quelles de `BentoGrid` et `Tile` côté
 * app (`apps/mobile/src/components/bento/`). Une divergence se verrait
 * immédiatement : la capture partagée depuis l'app et l'aperçu du lien
 * doivent montrer le même objet.
 *
 * Unité : la largeur nominale de la boîte vaut `DESIGN_WIDTH`. Côté web,
 * `--u` vaut `100cqw / DESIGN_WIDTH`, donc `calc(220 * var(--u))` rend
 * exactement 220 unités de design quelle que soit la largeur réelle.
 * Côté satori, on multiplie par un facteur d'échelle explicite.
 */

/** Largeur nominale de la boîte, bordures comprises. */
export const DESIGN_WIDTH = 361;

/** Hauteur nominale correspondante, dérivée ci-dessous et figée par un test. */
export const DESIGN_HEIGHT = 512;

export const FRAME = {
  /** Épaisseur du contour de la boîte. */
  border: 5,
  radius: 28,
  padding: 14,
  /** Espace entre deux rangées et entre deux compartiments d'une rangée. */
  gap: 10,
  /** Diamètre des rivets décoratifs dans les coins. */
  rivetSize: 8,
  rivetOffset: 8,
} as const;

export const ROW_HEIGHT = {
  film: 220,
  mid: 134,
  small: 100,
} as const;

export const TILE = {
  border: 2.5,
  radius: 18,
} as const;

/**
 * Voile de lisibilité posé sur les compartiments illustrés.
 *
 * Le titre est en blanc dès qu'il y a une photo, et rien ne garantit que
 * la photo soit sombre : le catalogue contient des pochettes quasi
 * blanches (« Suteki da ne », fond blanc) sur lesquelles un dégradé
 * s'arrêtant à 72 % laissait le texte illisible. Le voile démarre donc
 * plus haut et descend plus bas, ce qui garantit un fond sombre derrière
 * la zone de texte quelle que soit l'illustration.
 *
 * Partagé entre le rendu web et le rendu satori de l'image Open Graph,
 * pour que la vérification de contraste ne vaille pas que d'un côté.
 */
export const TILE_SCRIM =
  'linear-gradient(to bottom, rgba(0,0,0,0) 18%, rgba(0,0,0,0.5) 58%, rgba(0,0,0,0.88) 100%)';

/** Tailles typographiques par gabarit de compartiment. */
export const TILE_TYPO = {
  lg: { title: 28, subtitle: 13, padding: 16, stamp: 9, tracking: 1.2, initial: 140 },
  md: { title: 17, subtitle: 11, padding: 12, stamp: 9, tracking: 0.8, initial: 96 },
  sm: { title: 13, subtitle: 9.5, padding: 9, stamp: 8, tracking: 0.5, initial: 68 },
} as const;

export type TileSize = keyof typeof TILE_TYPO;

/**
 * Nombre de colonnes de la grille interne.
 *
 * 6 est le plus petit commun multiple de 1, 2 et 3, les trois découpages
 * de rangée. Les compartiments s'y placent par `span`, ce qui reproduit
 * **exactement** les largeurs de l'app tout en gardant une liste plate de
 * six éléments dans le DOM : un `<ul>` de six `<li>`, annoncé « liste de
 * 6 éléments » par un lecteur d'écran, plutôt que des listes imbriquées.
 *
 * Vérification, à la largeur nominale (contenu 323, gouttière 10) :
 *   colonne  = (323 - 5 × 10) / 6 = 45,5
 *   film     = 6 col + 5 gaps = 323    (pleine largeur)
 *   série    = 3 col + 2 gaps = 156,5  (= (323 - 10) / 2)
 *   chanson  = 2 col + 1 gap  = 101    (= (323 - 20) / 3)
 */
export const GRID_COLUMNS = 6;

/**
 * Disposition des compartiments, dans l'ordre du DOM.
 *
 * `span` est le nombre de colonnes occupées, `rotate` la micro-rotation qui
 * donne le côté « collé à la main » de la charte.
 */
export const TILE_LAYOUT: readonly {
  readonly category: CategoryKey;
  readonly row: 1 | 2 | 3;
  readonly span: number;
  readonly size: TileSize;
  readonly rotate: number;
}[] = [
  { category: 'film', row: 1, span: 6, size: 'lg', rotate: -0.5 },
  { category: 'series', row: 2, span: 3, size: 'md', rotate: 0.4 },
  { category: 'artist', row: 2, span: 3, size: 'md', rotate: -0.3 },
  { category: 'track', row: 3, span: 2, size: 'sm', rotate: -0.3 },
  { category: 'creator', row: 3, span: 2, size: 'sm', rotate: 0.5 },
  { category: 'place', row: 3, span: 2, size: 'sm', rotate: -0.2 },
] as const;

/** Hauteur de chaque rangée, dans l'ordre. */
export const ROW_HEIGHTS: readonly number[] = [
  ROW_HEIGHT.film,
  ROW_HEIGHT.mid,
  ROW_HEIGHT.small,
];

/**
 * Hauteur nominale, recalculée depuis les constantes.
 * Exportée pour que le test puisse vérifier qu'elle vaut bien
 * `DESIGN_HEIGHT` : si quelqu'un modifie une hauteur de rangée sans
 * ajuster la constante, l'image OG serait rognée.
 */
export function computeDesignHeight(): number {
  const rows = ROW_HEIGHT.film + ROW_HEIGHT.mid + ROW_HEIGHT.small;
  const gaps = FRAME.gap * 2;
  const chrome = (FRAME.padding + FRAME.border) * 2;
  return rows + gaps + chrome;
}

/** Largeur nominale d'un compartiment, selon le nombre par rangée. */
export function tileWidth(perRow: number): number {
  const inner = DESIGN_WIDTH - (FRAME.padding + FRAME.border) * 2;
  return (inner - FRAME.gap * (perRow - 1)) / perRow;
}

/**
 * Indice `sizes` pour `next/image`, par gabarit.
 *
 * Sans cet indice, Next sert la variante la plus large de `deviceSizes` et
 * on perd l'essentiel du bénéfice : la boîte ne dépasse jamais
 * `MAX_RENDERED_WIDTH`, un compartiment de la 3e rangée fait donc au plus
 * une centaine de pixels CSS.
 */
export const MAX_RENDERED_WIDTH = 420;

export const TILE_SIZES: Readonly<Record<TileSize, string>> = {
  lg: '(max-width: 460px) 88vw, 380px',
  md: '(max-width: 460px) 44vw, 186px',
  sm: '(max-width: 460px) 29vw, 122px',
};
