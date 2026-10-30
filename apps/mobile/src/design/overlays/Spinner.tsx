import { useEffect } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../theme';
import type { ColorToken } from '../tokens';
import { useMotion } from '../useMotion';

export type SpinnerProps = {
  /** 18 par défaut, 14 dans un petit bouton. */
  size?: number;
  /** La couleur du texte qu'il accompagne, `text-primary` par défaut. */
  color?: ColorToken;
  /** Une couleur déjà résolue, celle d'un bouton qui le porte, à la place de `color`. */
  tint?: string;
  /** Seulement quand il est seul à dire que ça charge. */
  label?: string;
};

/**
 * Le chargement (chantier 30, famille des calques) : un anneau de 2,5 ouvert à
 * droite qui tourne, un tour en 0,8 s, en 2,4 s quand le système réduit les
 * animations (`useMotion().spin`).
 */
export function Spinner({ size = 18, color = 'text-primary', tint, label }: SpinnerProps) {
  const { colors } = useTheme();
  const { spin } = useMotion();
  const turn = useSharedValue(0);
  useEffect(() => {
    turn.value = 0;
    turn.value = withRepeat(
      withTiming(1, { duration: spin, easing: Easing.linear, reduceMotion: ReduceMotion.Never }),
      -1,
      false,
    );
    return () => cancelAnimation(turn);
  }, [spin, turn]);
  const rotation = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 360}deg` }] }));
  const accessibility = label
    ? { accessible: true, accessibilityRole: 'progressbar' as const, accessibilityLabel: label }
    : {
        accessible: false,
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants' as const,
      };
  return (
    <Animated.View
      {...accessibility}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2.5,
          borderColor: tint ?? colors[color],
          borderRightColor: 'transparent',
          opacity: 0.9,
        },
        rotation,
      ]}
    />
  );
}
