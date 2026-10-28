// Mon Bento Pop — composants (window.MonBentoPop). Types de documentation.
// Toutes les props acceptent aussi leur forme texte ("true", "4") pour être posées en attributs dans un canevas.
import type { ReactNode } from 'react';

export type Category = 'film' | 'serie' | 'artiste' | 'son' | 'crea' | 'lieu';
export type Mood = 'content' | 'bisou' | 'fille' | 'intello' | 'gene' | 'surpris' | 'nani' | 'enerve' | 'intello-enerve' | 'malade' | 'diable';
export type PantryColor = 'yolk' | 'ume' | 'thon' | 'sakura' | 'shiso' | 'ramune' | 'wasabi' | 'rice' | 'white';
export type DemoArt = 'dusk' | 'ocean' | 'forest' | 'neon' | 'sunset' | 'stage' | 'city' | 'studio' | 'night' | 'meadow';

/** Un item du catalogue posé dans une case. */
export interface Item {
  title: string;
  /** Année, métier, interprète… */
  subtitle?: string;
  /** Crédit de l'image, obligatoire quand la licence le demande. */
  credit?: string;
  /** Adresse de l'image (affiche, photo). */
  image?: string;
  /** Visuel de démonstration pour les maquettes, à la place d'une image. */
  art?: DemoArt;
  /** Lettre géante d'une case sans image (par défaut : la première lettre du titre). */
  initial?: string;
  /** Proposé au catalogue, en attente de validation. */
  pending?: boolean;
}

/** Une case d'édition : sa catégorie, sa question, son item. */
export interface Slot { category: Category; prompt?: string; item?: Item | null; next?: boolean }

export interface IconProps { name: string; size?: number; weight?: 'bold' | 'fill' | 'regular'; label?: string }
export interface SpinnerProps { size?: number; label?: string }
export interface BadgeProps { count?: number; dot?: boolean; label?: string }
export interface PopyProps { mood?: Mood; size?: number; tilt?: number; wiggle?: boolean; alt?: string }
export interface AvatarProps { mood?: Mood; color?: PantryColor; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number; label?: string }
export interface LogoProps { height?: number }
export interface AppIconProps { size?: number }
export interface StickerProps { label?: string; children?: ReactNode; tone?: 'ink' | 'yolk' | 'rice'; tilt?: number }
export interface DisplayProps { size?: 'xl' | 'l' | 'm'; text?: string; children?: ReactNode; outline?: string; align?: 'left' | 'center' }

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'tertiary' | 'tertiary-danger' | 'danger' | 'inverse' | 'on-brand';
  size?: 'lg' | 'md' | 'sm';
  icon?: string; iconRight?: string;
  block?: boolean; loading?: boolean; disabled?: boolean;
  label?: string; children?: ReactNode; href?: string;
}
export interface IconButtonProps { icon: string; label: string; variant?: 'plain' | 'tonal' | 'outline' | 'media'; size?: 'md' | 'sm'; weight?: 'bold' | 'fill' | 'regular'; badge?: number; active?: boolean }

export interface ScreenProps { theme?: 'light' | 'dark'; tone?: 'app' | 'surface' | 'sunken' | 'brand'; safeTop?: boolean; label?: string; children?: ReactNode }
export interface TopBarAction { icon?: string; label: string; badge?: number; kind?: 'pill'; tone?: 'danger'; active?: boolean }
export interface TopBarProps {
  variant?: 'inline' | 'large' | 'brand';
  title?: string; eyebrow?: string; subtitle?: string;
  back?: boolean; backLabel?: string; close?: boolean; closeLabel?: string;
  actions?: TopBarAction[]; border?: boolean; children?: ReactNode;
}
export interface TabBarProps { active?: 'table' | 'trouver' | 'compose' | 'notifs' | 'profil'; notifs?: number; mood?: Mood; color?: PantryColor }
export interface TabsProps { items: string | Array<string | { label: string; count?: number }>; value?: number; fill?: boolean; border?: boolean }
export interface ChipProps { label?: string; children?: ReactNode; selected?: boolean; variant?: 'filter' | 'add' | 'suggestion'; count?: number; icon?: string }
export interface StepsProps { count?: number; index?: number; label?: string }
export interface ProgressProps { value?: number; total?: number; label?: string }
export interface SectionHeaderProps { title: string; action?: string; actionIcon?: string }

export interface TagProps { category: Category; variant?: 'media' | 'surface' | 'plain'; label?: string; icon?: boolean }
export interface BentoTileProps { item?: Item | null; category?: Category; size?: 'xl' | 'l' | 's'; mode?: 'view' | 'edit'; prompt?: string; next?: boolean }
export interface BentoProps {
  /** Six items dans l'ordre Film, Série, Artiste, Chanson, Créateur de contenu, Lieu ; null pour une case vide. */
  items?: Array<Item | null>;
  /** Six cases d'édition (catégorie et question au choix). */
  slots?: Slot[];
  prompts?: string | string[];
  mode?: 'view' | 'edit';
  density?: 'feed' | 'compose' | 'mini' | 'share';
  label?: string;
}
export interface ThumbProps { item?: Item; category?: Category; size?: number }
export interface ItemCardProps { item: Item; category?: Category }
export interface ItemGridProps { items: Array<Item & { category?: Category }>; category?: Category }
export interface ProposeRowProps { query: string; subtitle?: string }
export interface ShareCardProps { handle: string; items?: Array<Item | null>; slots?: Slot[]; scale?: number }

export interface ActionBarProps { likes?: number; liked?: boolean; comments?: number; commentLabel?: string; showLikes?: boolean; share?: boolean }
export interface PostHeaderProps { handle: string; name?: string; time?: string; mood?: Mood; color?: PantryColor }
export interface PostProps extends PostHeaderProps, ActionBarProps { items?: Array<Item | null>; slots?: Slot[] }
export interface Stat { value: number | string; label: string; link?: boolean }
export interface ProfileHeaderProps { handle: string; name?: string; meta?: string; mood?: Mood; color?: PantryColor; socials?: string | Array<'instagram' | 'tiktok'>; stats?: Stat[]; children?: ReactNode }
export interface StatusPillProps { label?: string; tone?: 'live' | 'pending' }
export interface AchievementProps { label: string; mood?: Mood; color?: PantryColor }
export interface AchievementsProps { items: AchievementProps[] }
export interface WhyEntryProps { category: Category; title: string; quote?: string; item?: Item; more?: boolean }
export interface WhyFieldProps { category: Category; title: string; item?: Item; value?: string; placeholder?: string }
export interface CommentProps { handle: string; time?: string; text: string; mood?: Mood; color?: PantryColor }
export interface CommentComposerProps { placeholder?: string; value?: string; canSend?: boolean }
export interface MedallionProps { kind?: 'like' | 'validated' | 'refused' | 'edition' | 'achievement' | 'follow' | 'comment'; mood?: Mood; color?: PantryColor; size?: number }
export interface NotificationRowProps { kind?: MedallionProps['kind']; mood?: Mood; color?: PantryColor; time?: string; text?: string; children?: ReactNode }
export interface AccountRowProps { handle: string; name?: string; detail?: string; detailCategory?: Category; mood?: Mood; color?: PantryColor; trailing?: 'chevron' | 'none'; actions?: Array<{ label: string; variant?: ButtonProps['variant']; icon?: string }> }
export interface PopyPickProps { mood: Mood; label: string; selected?: boolean }

export interface ListProps { header?: string; footer?: string; plain?: boolean; children?: ReactNode }
export interface ListRowProps { icon?: string; title: string; subtitle?: string; note?: string; detail?: string; trailing?: 'chevron' | 'external' | 'switch' | 'spinner' | 'none'; checked?: boolean; tone?: 'default' | 'danger'; strong?: boolean }
export interface SwitchProps { checked?: boolean; disabled?: boolean; label: string }
export interface CheckboxProps { checked?: boolean; label?: string; children?: ReactNode }
export interface RadioRowProps { label: string; checked?: boolean }
export interface TextFieldProps { label?: string; placeholder?: string; value?: string; prefix?: string; helper?: string; helperRight?: string; counter?: string; error?: string; multiline?: boolean; focused?: boolean; id?: string }
export interface SearchFieldProps { placeholder?: string; value?: string; focused?: boolean }
export interface CodeFieldProps { length?: number; value?: string; focused?: boolean; label?: string }
export interface RuleProps { icon?: string; tone?: 'default' | 'no'; text?: string; children?: ReactNode }

export interface SheetProps { title?: string; eyebrow?: string; eyebrowCategory?: Category; subtitle?: string; height?: 'auto' | 'large' | 'full'; close?: 'icon' | 'text' | 'none'; closeLabel?: string; action?: string; actionTone?: 'danger'; grabber?: boolean; scrim?: boolean; children?: ReactNode }
export interface SheetFooterProps { flat?: boolean; children?: ReactNode }
export interface AskSheetProps { mood?: Mood; title: string; message?: string; primary?: string; secondary?: string; secondaryVariant?: ButtonProps['variant']; confetti?: boolean }
export interface ActionSheetProps { title?: string; actions: Array<{ label: string; icon?: string; tone?: 'danger' }>; cancelLabel?: string }
export interface DialogProps { title: string; message?: string; mood?: Mood; actions: Array<{ label: string; variant?: ButtonProps['variant'] }> }
export interface ToastProps { message: string; action?: string; icon?: string; offset?: number }
export interface BannerProps { tone?: 'offline' | 'update' | 'info'; title?: string; message?: string; action?: string; closable?: boolean }
export interface InAppNoticeProps { title: string; message: string; time?: string }
export interface EmptyStateProps { mood?: Mood; title?: string; message?: string; action?: string; actionVariant?: ButtonProps['variant']; size?: number }
export interface PromptCardProps { mood?: Mood; text: string; action?: string }
export interface ConfettiProps {}
export interface SkeletonProps { kind?: 'post' | 'list'; rows?: number }
