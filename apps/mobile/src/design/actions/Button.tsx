import {
  PixelRatio,
  Platform,
  Pressable,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';
import { busyA11y } from '@/lib/a11y-states';
import { Icon } from '../Icon';
import type { IconName } from '../icons';
import { Spinner } from '../overlays/Spinner';
import { PopShadow } from '../PopShadow';
import { Text } from '../Text';
import { useTheme } from '../theme';
import { WRAP_FONT_SCALE } from '../type';
import { usePress } from './usePress';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'tertiary'
  | 'tertiary-danger'
  | 'danger'
  | 'inverse'
  | 'on-brand';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  /** `primary` : l'action principale de l'écran, une seule par écran. */
  variant?: ButtonVariant;
  /** `lg` 52, `md` 44, `sm` 32 dont la zone tactile reste de 44. */
  size?: 'lg' | 'md' | 'sm';
  icon?: IconName;
  iconRight?: IconName;
  /** Toute la largeur que le parent lui laisse. */
  block?: boolean;
  loading?: boolean;
  disabled?: boolean;
  /** La place du bouton dans l'écran (marges, alignement), jamais son dessin. */
  style?: StyleProp<ViewStyle>;
};

const SIZES = {
  lg: { height: 52, padding: 24, text: 'label-l', icon: 20, spinner: 18, gap: 8 },
  md: { height: 44, padding: 18, text: 'label-m', icon: 20, spinner: 18, gap: 8 },
  sm: { height: 32, padding: 14, text: 'label-s', icon: 16, spinner: 14, gap: 6 },
} as const;

/** Au-delà, un libellé passe sur deux lignes au lieu d'être coupé. */
const WRAP_LENGTH = 34;

/**
 * Le bouton, en pilule (chantier 30, famille des actions).
 *
 * `primary` se pose sur son ombre franche et s'y enfonce à l'appui : sa face
 * glisse sur le calque de l'ombre, du décalage de celle-ci arrondi au pixel,
 * pour le couvrir exactement. `secondary` et `inverse` se réduisent à 98 %.
 * Au-delà de 34 caractères, et dès que le texte du système passe 130 %, le
 * libellé va à la ligne et le bouton grandit, jamais sous sa hauteur.
 * Désactivé, il passe en creux ; en chargement, il garde ses couleurs et
 * se dit occupé.
 *
 * `tertiary` est souligné, sauf en petite taille : les aperçus du dossier ne
 * le soulignent pas (« Tout voir » de `SectionHeader`), leur CSS coupant le
 * trait sous un libellé de 16 de haut.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  iconRight,
  block,
  loading,
  disabled,
  style,
}: ButtonProps) {
  const { colors, palette, border, radius, shadow } = useTheme();
  const { fontScale } = useWindowDimensions();
  const { pressed, onPressIn, onPressOut } = usePress();
  const metrics = SIZES[size];
  const blocked = Boolean(disabled || loading);
  const dimmed = Boolean(disabled && !loading);
  const tertiary = variant === 'tertiary' || variant === 'tertiary-danger';
  const wraps = label.length > WRAP_LENGTH || fontScale >= WRAP_FONT_SCALE;

  const looks: Record<ButtonVariant, { bg: string; fg: string; pressedBg?: string }> = {
    primary: { bg: colors.accent, fg: colors['on-accent'], pressedBg: colors['accent-pressed'] },
    secondary: {
      bg: colors['bg-sunken'],
      fg: colors['text-primary'],
      pressedBg: colors['bg-pressed'],
    },
    outline: { bg: 'transparent', fg: colors['text-primary'] },
    tertiary: { bg: 'transparent', fg: colors['text-primary'] },
    'tertiary-danger': { bg: 'transparent', fg: colors['text-danger'] },
    danger: { bg: colors.danger, fg: colors['on-danger'] },
    inverse: { bg: colors['bg-inverse'], fg: colors['text-on-inverse'] },
    'on-brand': { bg: palette['nori-900'], fg: palette['rice-100'] },
  };
  const look = dimmed
    ? { bg: tertiary ? 'transparent' : colors['bg-sunken'], fg: colors['text-tertiary'] }
    : looks[variant];
  const bg = look.bg;
  const pressedBg = ('pressedBg' in look && look.pressedBg) || bg;
  const outline = variant === 'outline' && !dimmed;
  const shadowed = variant === 'primary' && !dimmed;
  const level = size === 'sm' ? 'pop-sm' : 'pop';
  const sinkX = shadowed ? PixelRatio.roundToNearestPixel(shadow[level].x) : 0;
  const sinkY = shadowed ? PixelRatio.roundToNearestPixel(shadow[level].y) : 0;
  const shrinks = (variant === 'secondary' || variant === 'inverse') && !dimmed;

  const animated = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(pressed.value, [0, 1], [bg, pressedBg]),
    transform: [
      { translateX: sinkX * pressed.value },
      { translateY: sinkY * pressed.value },
      { scale: shrinks ? 1 - 0.02 * pressed.value : 1 },
    ],
  }));

  const a11y = busyA11y({ disabled: blocked, busy: Boolean(loading) }, Platform.OS);
  const pressable = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={a11y.state}
      accessibilityValue={a11y.value}
      disabled={blocked}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      hitSlop={size === 'sm' ? { top: 6, bottom: 6, left: 2, right: 2 } : undefined}
      style={shadowed ? undefined : [block && { alignSelf: 'stretch' }, style]}
    >
      <Animated.View
        style={[
          {
            minHeight: tertiary && size !== 'sm' ? 44 : metrics.height,
            height: wraps || tertiary ? undefined : metrics.height,
            paddingHorizontal: tertiary ? 8 : metrics.padding,
            paddingVertical: wraps ? 8 : 0,
            borderRadius: radius.full,
            borderWidth: outline ? border.control : border.ink,
            borderColor: shadowed ? colors.ink : outline ? colors['border-strong'] : 'transparent',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: metrics.gap,
          },
          animated,
        ]}
      >
        {loading ? (
          <Spinner size={metrics.spinner} tint={look.fg} />
        ) : icon ? (
          <Icon name={icon} size={metrics.icon} tint={look.fg} />
        ) : null}
        <Text
          variant={metrics.text}
          numberOfLines={wraps ? undefined : 1}
          style={[
            { color: look.fg, flexShrink: 1 },
            wraps && { textAlign: 'center' },
            variant === 'tertiary' && size !== 'sm' && { textDecorationLine: 'underline' },
          ]}
        >
          {label}
        </Text>
        {iconRight && !loading ? (
          <Icon name={iconRight} size={metrics.icon} tint={look.fg} />
        ) : null}
      </Animated.View>
    </Pressable>
  );
  if (!shadowed) return pressable;
  return (
    <PopShadow
      level={level}
      radius={radius.full}
      style={[block && { alignSelf: 'stretch' }, style]}
    >
      {pressable}
    </PopShadow>
  );
}
