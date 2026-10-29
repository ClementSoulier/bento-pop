/**
 * Le design system v2 de l'app (chantier 30, `docs/UX-30-SOCLE-DESIGN-SYSTEM.md`),
 * tiré du dossier de la refonte, `docs/design-v2/`. Aucun écran ne l'emploie
 * encore : ils y passent du chantier 31 au 34 (D5).
 */
export { Icon, type IconProps, type IconWeight } from './Icon';
export type { IconName } from './icons';
export {
  CURVE,
  DURATION,
  motionFor,
  type Curve,
  type Duration,
  type Motion,
  type Timing,
  type Transition,
} from './motion';
export { PopShadow, type PopShadowProps, type ShadowLevel } from './PopShadow';
export { Text, type TextProps } from './Text';
export { ThemeProvider, THEMES, useTheme, type Scheme, type Theme } from './theme';
export type { ColorToken, PaletteToken } from './tokens';
export {
  CATEGORY_MAX_FONT_MULTIPLIER,
  WRAP_FONT_SCALE,
  categoryOf,
  textStyle,
  type TextCategory,
  type TextVariant,
} from './type';
export { timingConfig, useMotion } from './useMotion';
