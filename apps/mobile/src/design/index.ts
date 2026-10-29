/**
 * Le design system v2 de l'app (chantier 30, `docs/UX-30-SOCLE-DESIGN-SYSTEM.md`),
 * tiré du dossier de la refonte, `docs/design-v2/`. Aucun écran ne l'emploie
 * encore : ils y passent du chantier 31 au 34 (D5).
 *
 * Les fondations à la racine ; les composants rangés par famille, comme les
 * pages du catalogue : `structure/`, `actions/`, `brand/`, et `overlays/`
 * pour les calques et les retours.
 */
export { Button, type ButtonProps, type ButtonVariant } from './actions/Button';
export { Chip, type ChipProps } from './actions/Chip';
export { IconButton, type IconButtonProps } from './actions/IconButton';
export { AppIcon, type AppIconProps } from './brand/AppIcon';
export { Avatar, type AvatarProps, type AvatarSize, type PantryColor } from './brand/Avatar';
export { Display, type DisplayProps } from './brand/Display';
export { Logo, type LogoProps } from './brand/Logo';
export { Popy, type PopyProps } from './brand/Popy';
export { popyImage, type Mood } from './brand/popy-images';
export { Sticker, type StickerProps } from './brand/Sticker';
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
export { Badge, type BadgeProps } from './overlays/Badge';
export { Spinner, type SpinnerProps } from './overlays/Spinner';
export { PopShadow, type PopShadowProps, type ShadowLevel } from './PopShadow';
export { BrandGround, type BrandGroundProps } from './structure/BrandGround';
export { Screen, type ScreenProps, type ScreenTone } from './structure/Screen';
export { SectionHeader, type SectionHeaderProps } from './structure/SectionHeader';
export { Steps, type StepsProps } from './structure/Steps';
export { TabBar, type TabBarProps, type TabKey } from './structure/TabBar';
export { Tabs, type TabsItem, type TabsProps } from './structure/Tabs';
export { TopBar, type TopBarAction, type TopBarProps } from './structure/TopBar';
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
  type TextWeight,
} from './type';
export { timingConfig, useMotion } from './useMotion';
