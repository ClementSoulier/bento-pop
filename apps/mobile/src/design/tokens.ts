/**
 * Généré par `scripts/design-tokens.ts` depuis
 * `docs/design-v2/design-system/tokens.json` (chantier 30, D6) : ne pas
 * modifier à la main, relancer `pnpm design:tokens`.
 */

export type ColorToken =
  | 'bg-app'
  | 'bg-surface'
  | 'bg-sunken'
  | 'bg-pressed'
  | 'bg-elevated'
  | 'bg-brand'
  | 'bg-brand-dots'
  | 'bg-inverse'
  | 'bg-plate'
  | 'scrim'
  | 'text-primary'
  | 'text-secondary'
  | 'text-tertiary'
  | 'text-on-brand'
  | 'text-on-brand-muted'
  | 'text-on-inverse'
  | 'text-on-media'
  | 'text-danger'
  | 'text-success'
  | 'border-subtle'
  | 'border-default'
  | 'border-strong'
  | 'ink'
  | 'plate-outline'
  | 'pop-shadow'
  | 'accent'
  | 'accent-pressed'
  | 'on-accent'
  | 'accent-soft'
  | 'on-accent-soft'
  | 'control-on'
  | 'control-on-fg'
  | 'danger'
  | 'on-danger'
  | 'danger-soft'
  | 'on-danger-soft'
  | 'like'
  | 'success'
  | 'status-live-bg'
  | 'focus-ring'
  | 'focus-halo'
  | 'skeleton'
  | 'tabbar-bg'
  | 'toast-bg'
  | 'media-scrim'
  | 'cat-film'
  | 'cat-film-deep'
  | 'cat-serie'
  | 'cat-serie-deep'
  | 'cat-artiste'
  | 'cat-artiste-deep'
  | 'cat-son'
  | 'cat-son-deep'
  | 'cat-crea'
  | 'cat-crea-deep'
  | 'cat-lieu'
  | 'cat-lieu-deep';

export type PaletteToken =
  | 'yolk-50'
  | 'yolk-100'
  | 'yolk-200'
  | 'yolk-300'
  | 'yolk-400'
  | 'yolk-500'
  | 'yolk-600'
  | 'yolk-700'
  | 'yolk-900'
  | 'rice-0'
  | 'rice-50'
  | 'rice-100'
  | 'rice-200'
  | 'rice-300'
  | 'nori-900'
  | 'nori-800'
  | 'neutral-0'
  | 'neutral-100'
  | 'neutral-150'
  | 'neutral-200'
  | 'neutral-300'
  | 'neutral-400'
  | 'neutral-500'
  | 'neutral-550'
  | 'neutral-600'
  | 'neutral-650'
  | 'neutral-700'
  | 'neutral-800'
  | 'neutral-850'
  | 'neutral-900'
  | 'ume-300'
  | 'ume-500'
  | 'ume-700'
  | 'thon-300'
  | 'thon-500'
  | 'thon-700'
  | 'sakura-300'
  | 'sakura-500'
  | 'sakura-700'
  | 'shiso-300'
  | 'shiso-500'
  | 'shiso-700'
  | 'ramune-300'
  | 'ramune-500'
  | 'ramune-700'
  | 'wasabi-300'
  | 'wasabi-500'
  | 'wasabi-700';

/** Les couleurs sémantiques, résolues pour chaque thème : les seules que le code emploie. */
export const colors: Record<'light' | 'dark', Record<ColorToken, string>> = {
  light: {
    'bg-app': '#fffcf6',
    'bg-surface': '#ffffff',
    'bg-sunken': '#f4efe5',
    'bg-pressed': '#e2dacb',
    'bg-elevated': '#ffffff',
    'bg-brand': '#f2a82a',
    'bg-brand-dots': '#ffc845',
    'bg-inverse': '#0e0e0e',
    'bg-plate': '#f5efe0',
    scrim: 'rgba(14,14,14,0.5)',
    'text-primary': '#0e0e0e',
    'text-secondary': '#5e574b',
    'text-tertiary': '#716a5d',
    'text-on-brand': '#0e0e0e',
    'text-on-brand-muted': '#3d2a07',
    'text-on-inverse': '#f5efe0',
    'text-on-media': '#ffffff',
    'text-danger': '#b42f22',
    'text-success': '#3f6b1e',
    'border-subtle': '#ece5d7',
    'border-default': '#d3caba',
    'border-strong': '#8a8273',
    ink: '#0e0e0e',
    'plate-outline': '#0e0e0e',
    'pop-shadow': '#0e0e0e',
    accent: '#ffc845',
    'accent-pressed': '#f2a82a',
    'on-accent': '#0e0e0e',
    'accent-soft': '#fff3cc',
    'on-accent-soft': '#0e0e0e',
    'control-on': '#0e0e0e',
    'control-on-fg': '#ffc845',
    danger: '#c83a2e',
    'on-danger': '#ffffff',
    'danger-soft': '#ffe1dc',
    'on-danger-soft': '#8c2116',
    like: '#e5533f',
    success: '#55722f',
    'status-live-bg': '#e6f2d6',
    'focus-ring': '#0e0e0e',
    'focus-halo': '#ffc845',
    skeleton: '#ece5d7',
    'tabbar-bg': '#ffffff',
    'toast-bg': '#0e0e0e',
    'media-scrim': 'rgba(14,14,14,0.78)',
    'cat-film': '#ff8b7b',
    'cat-film-deep': '#a8301f',
    'cat-serie': '#c3a8ff',
    'cat-serie-deep': '#5b3cb3',
    'cat-artiste': '#ffadc6',
    'cat-artiste-deep': '#b23f62',
    'cat-son': '#7fdaeb',
    'cat-son-deep': '#10768c',
    'cat-crea': '#ffb25c',
    'cat-crea-deep': '#a85a0e',
    'cat-lieu': '#b5d88a',
    'cat-lieu-deep': '#55722f',
  },
  dark: {
    'bg-app': '#0e0e0e',
    'bg-surface': '#1a1a1a',
    'bg-sunken': '#242220',
    'bg-pressed': '#2c2925',
    'bg-elevated': '#242220',
    'bg-brand': '#f2a82a',
    'bg-brand-dots': '#ffc845',
    'bg-inverse': '#f5efe0',
    'bg-plate': '#2c2925',
    scrim: 'rgba(0,0,0,0.66)',
    'text-primary': '#f5efe0',
    'text-secondary': '#b5ad9d',
    'text-tertiary': '#9c9484',
    'text-on-brand': '#0e0e0e',
    'text-on-brand-muted': '#3d2a07',
    'text-on-inverse': '#0e0e0e',
    'text-on-media': '#ffffff',
    'text-danger': '#ff8e7e',
    'text-success': '#b5d88a',
    'border-subtle': '#2c2925',
    'border-default': '#3b3833',
    'border-strong': '#7d7567',
    ink: '#0e0e0e',
    'plate-outline': '#7d7567',
    'pop-shadow': '#d8901e',
    accent: '#ffc845',
    'accent-pressed': '#f2a82a',
    'on-accent': '#0e0e0e',
    'accent-soft': '#3d2e0a',
    'on-accent-soft': '#f5efe0',
    'control-on': '#ffc845',
    'control-on-fg': '#0e0e0e',
    danger: '#e5533f',
    'on-danger': '#0e0e0e',
    'danger-soft': '#3a1813',
    'on-danger-soft': '#ff8e7e',
    like: '#ff6b5b',
    success: '#b5d88a',
    'status-live-bg': '#25331a',
    'focus-ring': '#f5efe0',
    'focus-halo': '#ffc845',
    skeleton: '#2c2925',
    'tabbar-bg': '#0e0e0e',
    'toast-bg': '#3b3833',
    'media-scrim': 'rgba(14,14,14,0.78)',
    'cat-film': '#ff8b7b',
    'cat-film-deep': '#a8301f',
    'cat-serie': '#c3a8ff',
    'cat-serie-deep': '#5b3cb3',
    'cat-artiste': '#ffadc6',
    'cat-artiste-deep': '#b23f62',
    'cat-son': '#7fdaeb',
    'cat-son-deep': '#10768c',
    'cat-crea': '#ffb25c',
    'cat-crea-deep': '#a85a0e',
    'cat-lieu': '#b5d88a',
    'cat-lieu-deep': '#55722f',
  },
};

/** Les primitives, qui ne changent pas de thème : les teintes des avatars, par exemple. */
export const palette: Record<PaletteToken, string> = {
  'yolk-50': '#fff6dc',
  'yolk-100': '#ffe9a8',
  'yolk-200': '#ffd976',
  'yolk-300': '#ffc845',
  'yolk-400': '#f4b53a',
  'yolk-500': '#f2a82a',
  'yolk-600': '#d8901e',
  'yolk-700': '#b5751a',
  'yolk-900': '#3d2e0a',
  'rice-0': '#fffcf6',
  'rice-50': '#fbf7ec',
  'rice-100': '#f5efe0',
  'rice-200': '#efe7d2',
  'rice-300': '#e5d8b7',
  'nori-900': '#0e0e0e',
  'nori-800': '#1a1a1a',
  'neutral-0': '#ffffff',
  'neutral-100': '#f4efe5',
  'neutral-150': '#ece5d7',
  'neutral-200': '#e2dacb',
  'neutral-300': '#d3caba',
  'neutral-400': '#b5ad9d',
  'neutral-500': '#9c9484',
  'neutral-550': '#8a8273',
  'neutral-600': '#7d7567',
  'neutral-650': '#716a5d',
  'neutral-700': '#5e574b',
  'neutral-800': '#3b3833',
  'neutral-850': '#2c2925',
  'neutral-900': '#242220',
  'ume-300': '#ff8b7b',
  'ume-500': '#e5533f',
  'ume-700': '#a8301f',
  'thon-300': '#ffb25c',
  'thon-500': '#f39b2d',
  'thon-700': '#a85a0e',
  'sakura-300': '#ffadc6',
  'sakura-500': '#ee7a9c',
  'sakura-700': '#b23f62',
  'shiso-300': '#c3a8ff',
  'shiso-500': '#9470f0',
  'shiso-700': '#5b3cb3',
  'ramune-300': '#7fdaeb',
  'ramune-500': '#2fb5cf',
  'ramune-700': '#10768c',
  'wasabi-300': '#b5d88a',
  'wasabi-500': '#93b66a',
  'wasabi-700': '#55722f',
};

/** Les 22 styles de texte, en points ; `family` est le rôle de la police, cf. `type.ts`. */
export const type = {
  'display-xl': { family: 'display', fontSize: 44, lineHeight: 40, fontWeight: 900, letterSpacing: 0.44, textTransform: 'uppercase' },
  'display-l': { family: 'display', fontSize: 32, lineHeight: 30, fontWeight: 900, letterSpacing: 0.32, textTransform: 'uppercase' },
  'display-m': { family: 'display', fontSize: 24, lineHeight: 24, fontWeight: 900, letterSpacing: 0.24, textTransform: 'uppercase' },
  'tile-xl': { family: 'tile', fontSize: 28, lineHeight: 28, fontWeight: 700, letterSpacing: 0.28, textTransform: 'uppercase' },
  'tile-l': { family: 'tile', fontSize: 20, lineHeight: 21, fontWeight: 700, letterSpacing: 0.2, textTransform: 'uppercase' },
  'tile-m': { family: 'tile', fontSize: 15, lineHeight: 15, fontWeight: 700, letterSpacing: 0.15, textTransform: 'uppercase' },
  'tile-s': { family: 'tile', fontSize: 11, lineHeight: 12, fontWeight: 700, letterSpacing: 0.22, textTransform: 'uppercase' },
  'title-1': { family: 'heading', fontSize: 30, lineHeight: 36, fontWeight: 600 },
  'title-2': { family: 'heading', fontSize: 22, lineHeight: 28, fontWeight: 600 },
  'title-3': { family: 'heading', fontSize: 18, lineHeight: 24, fontWeight: 600 },
  'label-l': { family: 'heading', fontSize: 17, lineHeight: 22, fontWeight: 600 },
  'label-m': { family: 'heading', fontSize: 15, lineHeight: 20, fontWeight: 600 },
  'label-s': { family: 'heading', fontSize: 13, lineHeight: 16, fontWeight: 600 },
  eyebrow: { family: 'heading', fontSize: 12, lineHeight: 16, fontWeight: 600, letterSpacing: 0.72, textTransform: 'uppercase' },
  'tab-label': { family: 'heading', fontSize: 11, lineHeight: 14, fontWeight: 500 },
  'body-l': { family: 'text', fontSize: 17, lineHeight: 24, fontWeight: 400 },
  body: { family: 'text', fontSize: 16, lineHeight: 22, fontWeight: 400 },
  'body-strong': { family: 'text', fontSize: 16, lineHeight: 22, fontWeight: 600 },
  subhead: { family: 'text', fontSize: 15, lineHeight: 20, fontWeight: 400 },
  'subhead-strong': { family: 'text', fontSize: 15, lineHeight: 20, fontWeight: 600 },
  footnote: { family: 'text', fontSize: 13, lineHeight: 18, fontWeight: 400 },
  caption: { family: 'text', fontSize: 12, lineHeight: 16, fontWeight: 500 },
} as const;

export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  full: 999,
} as const;

export const border = {
  hairline: 1,
  control: 1.5,
  ink: 2,
} as const;

export const size = {
  touch: 44,
  topbar: 52,
  tabbar: 56,
  'button-lg': 52,
  'button-md': 44,
  'button-sm': 32,
  field: 52,
  'avatar-xs': 24,
  'avatar-sm': 32,
  'avatar-md': 44,
  'avatar-lg': 56,
  'avatar-xl': 96,
  icon: 24,
  'icon-sm': 20,
  'screen-margin': 16,
  'safe-top': 62,
  'safe-bottom': 34,
  'plate-padding': 8,
  'plate-gap': 6,
} as const;

/** Les ombres franches de chaque thème : décalées, sans flou, cf. `shadow.ts`. */
export const shadow = {
  light: {
    'pop-sm': { x: 2, y: 2, color: '#0e0e0e' },
    pop: { x: 3, y: 3, color: '#0e0e0e' },
    'pop-lg': { x: 5, y: 5, color: '#0e0e0e' },
  },
  dark: {
    'pop-sm': { x: 2, y: 2, color: '#d8901e' },
    pop: { x: 3, y: 3, color: '#d8901e' },
    'pop-lg': { x: 5, y: 5, color: '#d8901e' },
  },
} as const;
