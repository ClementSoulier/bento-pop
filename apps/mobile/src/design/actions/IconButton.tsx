import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { Icon, type IconWeight } from '../Icon';
import type { IconName } from '../icons';
import { Badge } from '../overlays/Badge';
import { useTheme } from '../theme';
import type { ColorToken } from '../tokens';
import { usePress } from './usePress';

export type IconButtonProps = {
  icon: IconName;
  /** Obligatoire : c'est lui que lisent VoiceOver et TalkBack. */
  label: string;
  onPress?: () => void;
  /** `plain` dans les barres, `tonal` pour fermer une feuille, `outline`, `media` sur une image. */
  variant?: 'plain' | 'tonal' | 'outline' | 'media';
  /** `md` 44, `sm` 36 dont la zone tactile reste de 44. */
  size?: 'md' | 'sm';
  weight?: IconWeight;
  badge?: number;
  /** Un bouton bascule : son icône passe en `fill`, et il se dit sélectionné. */
  active?: boolean;
  disabled?: boolean;
  /** L'icône d'un bouton moyen dans un cadre de 36 : l'effacement d'une recherche. */
  iconSize?: number;
  /** `text-primary` par défaut ; `text-tertiary` pour l'effacement d'une recherche. */
  color?: ColorToken;
  style?: StyleProp<ViewStyle>;
};

/**
 * Un bouton réduit à son icône (chantier 30, famille des actions) : 44 de
 * côté, un fond rond retiré de 4 pour les variantes `tonal`, `outline` et
 * `media`, une pression qui le réduit à 92 %.
 */
export function IconButton({
  icon,
  label,
  onPress,
  variant = 'plain',
  size = 'md',
  weight = 'bold',
  badge,
  active,
  disabled,
  iconSize,
  color = 'text-primary',
  style,
}: IconButtonProps) {
  const { colors, palette, border } = useTheme();
  const { pressed, onPressIn, onPressOut } = usePress();
  const side = size === 'sm' ? 36 : 44;
  const scale = useAnimatedStyle(() => ({ transform: [{ scale: 1 - 0.08 * pressed.value }] }));
  const ground: Record<'plain' | 'tonal' | 'outline' | 'media', ViewStyle | null> = {
    plain: null,
    tonal: { backgroundColor: colors['bg-sunken'] },
    outline: { borderWidth: border.control, borderColor: colors['border-strong'] },
    media: { backgroundColor: palette['nori-900'], opacity: 0.55 },
  };
  const backdrop = ground[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled), selected: active }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      hitSlop={size === 'sm' ? 4 : undefined}
      style={[{ width: side, height: side }, style]}
    >
      <Animated.View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center' }, scale]}>
        {backdrop ? (
          <View
            pointerEvents="none"
            style={[
              { position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, borderRadius: side },
              backdrop,
            ]}
          />
        ) : null}
        <Icon
          name={icon}
          size={iconSize ?? (size === 'sm' ? 20 : 24)}
          weight={active ? 'fill' : weight}
          color={disabled ? 'text-tertiary' : variant === 'media' ? 'text-on-media' : color}
        />
        {badge !== undefined ? (
          <Badge count={badge} style={{ position: 'absolute', top: 2, right: 0 }} />
        ) : null}
      </Animated.View>
    </Pressable>
  );
}
