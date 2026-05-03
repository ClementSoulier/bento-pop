import type { PopyKey } from './popys';

export type LayoutKey = 'A' | 'B' | 'C';

export type Layout = {
  key: LayoutKey;
  className: string;
  label: string;
  /** Liste ordonnée des Popys exposés dans la grille. */
  dishes: readonly PopyKey[];
};

export const LAYOUTS: Record<LayoutKey, Layout> = {
  A: {
    key: 'A',
    className: 'variant-A',
    label: 'SHOKADO 7',
    dishes: ['content', 'diable', 'fille', 'nani', 'intello', 'enerve', 'gene'] as const,
  },
  B: {
    key: 'B',
    className: 'variant-B',
    label: 'KYUKAKU 9',
    dishes: [
      'content',
      'fille',
      'nani',
      'gene',
      'diable',
      'enerve',
      'intelloEnerve',
      'malade',
      'intello',
    ] as const,
  },
  C: {
    key: 'C',
    className: 'variant-C',
    label: 'STRATIFIE 6',
    dishes: ['content', 'nani', 'fille', 'gene', 'intello', 'diable'] as const,
  },
};

export const DEFAULT_LAYOUT: LayoutKey = 'A';
