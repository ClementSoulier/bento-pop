import { useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../theme';
import { timingConfig, useMotion } from '../useMotion';

export type SwitchProps = {
  checked: boolean;
  onValueChange: (next: boolean) => void;
  /** Le titre de ce qu'il règle : c'est lui que lisent VoiceOver et TalkBack. */
  label: string;
  disabled?: boolean;
};

/**
 * L'interrupteur (chantier 30, famille des listes et de la saisie) : 52 sur
 * 32, sa zone tactile portée à 56 sur 44. Dans une ligne de réglage, c'est
 * `ListRow trailing="switch"` qu'on pose : la ligne entière le bascule.
 */
export function Switch({ checked, onValueChange, label, disabled }: SwitchProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={() => onValueChange(!checked)}
      hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
    >
      <SwitchTrack checked={checked} disabled={disabled} />
    </Pressable>
  );
}

/**
 * Le dessin de l'interrupteur, sans toucher ni focus : allumé, encre et
 * pastille jaune ; éteint, creux cerné de gris et pastille blanche. La
 * pastille glisse de 20 sur la courbe à rebond, la piste change de couleur en
 * 200 ms ; la pastille change de couleur d'un coup, comme dans le CSS du
 * dossier. Quand le système réduit les animations, elle saute.
 */
export function SwitchTrack({ checked, disabled }: { checked: boolean; disabled?: boolean }) {
  const { colors, border, radius } = useTheme();
  const motion = useMotion();
  const tint = useSharedValue(checked ? 1 : 0);
  const slide = useSharedValue(checked ? 1 : 0);
  useEffect(() => {
    tint.value = withTiming(checked ? 1 : 0, timingConfig(motion.fade('base')));
    slide.value = withTiming(checked ? 1 : 0, timingConfig(motion.move('base', 'pop')));
  }, [checked, motion, tint, slide]);
  const offTrack = colors['bg-sunken'];
  const offBorder = colors['border-strong'];
  const on = colors['control-on'];
  const track = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(tint.value, [0, 1], [offTrack, on]),
    borderColor: interpolateColor(tint.value, [0, 1], [offBorder, on]),
  }));
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: 20 * slide.value }] }));
  return (
    <Animated.View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width: 52,
          height: 32,
          borderRadius: radius.full,
          borderWidth: border.control,
          opacity: disabled ? 0.45 : 1,
        },
        track,
      ]}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 3,
            left: 3,
            width: 23,
            height: 23,
            borderRadius: radius.full,
            borderWidth: border.control,
            borderColor: checked ? colors['control-on-fg'] : colors['border-strong'],
            backgroundColor: checked ? colors['control-on-fg'] : colors['bg-surface'],
          },
          thumb,
        ]}
      />
    </Animated.View>
  );
}
