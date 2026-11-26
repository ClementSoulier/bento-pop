/**
 * La grille des résultats d'une case, `ItemGrid` (chantier 32, lot 3) : trois
 * colonnes, 10 entre elles, 16 entre les rangées, aux mesures de `bundle.css`
 * (`.mbp-itemgrid`). Aucun import de `react-native` : les tests lisent ce module
 * sous `node:test`.
 */

export const ITEM_GRID = {
  columns: 3,
  columnGap: 10,
  rowGap: 16,
} as const;

/** L'affiche d'un item, 2 sur 3 : sa hauteur pour une largeur donnée. */
export const ITEM_POSTER_RATIO = 3 / 2;

/** L'écart entre l'affiche et le titre, et le titre et son sous-titre (6, moins 4). */
export const ITEM_CARD_GAP = 6;
export const ITEM_SUBTITLE_GAP = 2;

/** Les lignes du titre (`footnote`, 18) et du sous-titre (`caption`, 16), texte du système à 100 %. */
export const ITEM_TITLE_LINE = 18;
export const ITEM_SUBTITLE_LINE = 16;

/** La hauteur d'un item : l'affiche, son titre sur une ou deux lignes, et son sous-titre s'il en a un. */
export function itemCardHeight(width: number, titleLines: 1 | 2, subtitle: boolean): number {
  return (
    width * ITEM_POSTER_RATIO +
    ITEM_CARD_GAP +
    titleLines * ITEM_TITLE_LINE +
    (subtitle ? ITEM_SUBTITLE_GAP + ITEM_SUBTITLE_LINE : 0)
  );
}

/**
 * La largeur d'une colonne : la grille moins ses deux gouttières, en trois. Le
 * plancher de 1 garde une première mise en page à largeur nulle visible.
 */
export function itemColumnWidth(gridWidth: number): number {
  const { columns, columnGap } = ITEM_GRID;
  return Math.max(1, (gridWidth - columnGap * (columns - 1)) / columns);
}

/**
 * Les rangées de la grille, de trois au plus. La dernière garde ses trous : une
 * colonne reste à sa place quand un seul résultat sort, comme sur `c03`.
 */
export function itemGridRows<T>(items: readonly T[]): (T | null)[][] {
  const { columns } = ITEM_GRID;
  const rows: (T | null)[][] = [];
  for (let start = 0; start < items.length; start += columns) {
    const row: (T | null)[] = items.slice(start, start + columns);
    while (row.length < columns) row.push(null);
    rows.push(row);
  }
  return rows;
}

/**
 * Ce que dit le lecteur d'écran d'un item, quand l'écran n'en dit pas plus :
 * « Choisir Inception, 2010 », comme la recherche depuis le chantier 3.
 */
export function itemCardAccessibilityLabel(title: string, subtitle?: string | null): string {
  return `Choisir ${title}${subtitle ? `, ${subtitle}` : ''}`;
}
