/**
 * Bento Pop — design tokens.
 * Source de vérité unique pour les couleurs, espacements, rayons et ombres.
 * Consommés via le preset Tailwind (`@bento-pop/brand/tailwind`) et via
 * variables CSS (`tokens.css`) pour les usages hors classes utilitaires.
 */

export const colors = {
  yellow: '#fbbf24',
  yellowAlt: '#f59e0b',
  yellowDeep: '#d97706',
  orange: '#f59331',
  cream: '#fbf3de',
  creamAlt: '#f5e8c9',
  ink: '#0a0a0a',
  inkSoft: '#1a1a1a',
  pink: '#f4a6a6',
  redAccent: '#e63946',
  // Compartiment tints (variations)
  tintA: '#ffecc2',
  tintB: '#ffe5a8',
  tintC: '#fff0c7',
  tintD: '#ffd98a',
  tintBase: '#fff4d8',
  tintLit: '#ffd857',
} as const;

export const radii = {
  sm: '8px',
  md: '16px',
  lg: '22px',
  xl: '30px',
  bento: '36px',
  pill: '999px',
} as const;

export const shadows = {
  /** "stamped" 4px black drop, signature visuelle Bento Pop. */
  stamp: '0 4px 0 var(--bento-ink)',
  stampLg: '0 8px 0 var(--bento-ink)',
  stampXl: '0 10px 0 var(--bento-ink)',
  card: '0 8px 0 var(--bento-ink), 0 14px 30px rgba(0,0,0,0.25)',
  reveal: '0 12px 0 var(--bento-ink), 0 24px 60px rgba(0,0,0,0.4)',
} as const;

export const borderWidths = {
  thin: '2px',
  base: '3px',
  thick: '5px',
  bold: '6px',
} as const;

export const easings = {
  pop: 'cubic-bezier(.2,1.8,.4,1)',
  bounce: 'cubic-bezier(.3,1.5,.5,1)',
} as const;

export type BentoColors = typeof colors;
export type BentoRadii = typeof radii;
