/**
 * Le design system v2 de l'app (chantier 30, `docs/UX-30-SOCLE-DESIGN-SYSTEM.md`),
 * tiré du dossier de la refonte, `docs/design-v2/`. Aucun écran ne l'emploie
 * encore : ils y passent du chantier 31 au 34 (D5).
 *
 * Les fondations à la racine ; les composants rangés par famille, comme les
 * pages du catalogue : `structure/`, `actions/`, `brand/`, `inputs/` pour
 * les listes et la saisie, et `overlays/` pour les calques et les retours.
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
export { Checkbox, type CheckboxProps } from './inputs/Checkbox';
export { CodeField, type CodeFieldProps } from './inputs/CodeField';
export { List, type ListProps } from './inputs/List';
export { ListRow, type ListRowProps, type ListRowTrailing } from './inputs/ListRow';
export { RadioRow, type RadioRowProps } from './inputs/RadioRow';
export { Rule, type RuleProps } from './inputs/Rule';
export { SearchField, type SearchFieldProps } from './inputs/SearchField';
export { Switch, type SwitchProps } from './inputs/Switch';
export { TextField, type TextFieldProps } from './inputs/TextField';
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
export { ActionSheet, type ActionSheetAction, type ActionSheetProps } from './overlays/ActionSheet';
export { AskSheet, type AskSheetProps } from './overlays/AskSheet';
export { Badge, type BadgeProps } from './overlays/Badge';
export { Banner, type BannerProps } from './overlays/Banner';
export { Confetti, type ConfettiProps } from './overlays/Confetti';
export { Dialog, type DialogAction, type DialogProps } from './overlays/Dialog';
export { EmptyState, type EmptyStateProps } from './overlays/EmptyState';
export { InAppNotice, NOTICE_DURATION, type InAppNoticeProps } from './overlays/InAppNotice';
export type { SheetHeight } from './overlays/Layer';
export { PromptCard, type PromptCardProps } from './overlays/PromptCard';
export { Sheet, SheetFooter, type SheetFooterProps, type SheetProps } from './overlays/Sheet';
export { Skeleton, type SkeletonProps } from './overlays/Skeleton';
export { Spinner, type SpinnerProps } from './overlays/Spinner';
export { Toast, TOAST_DURATION, type ToastProps } from './overlays/Toast';
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
  reachesWrapScale,
  textStyle,
  type TextCategory,
  type TextVariant,
  type TextWeight,
} from './type';
export { useAnnouncement } from './useAnnouncement';
export { timingConfig, useMotion } from './useMotion';
