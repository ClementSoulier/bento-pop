import { useEffect } from 'react';
import { Platform, View, type DimensionValue } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { busyA11y } from '@/lib/a11y-states';
import { useTheme } from '../theme';
import { useMotion } from '../useMotion';

export type SkeletonProps = {
  /** `post` par défaut, un post et son plateau ; `list`, des lignes. */
  kind?: 'post' | 'list';
  /** Le nombre de lignes d'une liste, 3 par défaut. */
  rows?: number;
};

/**
 * Les blocs de chargement d'un fil ou d'une liste (chantier 30, famille des
 * calques et des retours) : des blocs `skeleton` qui pulsent ensemble, de
 * tout à 55 % et retour en 1,4 s ; immobiles quand le système réduit les
 * animations. Le plateau d'un post reprend la grille d'un bento : une case
 * en 16/9, deux en 6/5, trois carrées.
 *
 * Le lecteur d'écran n'y lit qu'un élément, « Chargement », occupé.
 */
export function Skeleton({ kind = 'post', rows = 3 }: SkeletonProps) {
  const { colors, border, radius } = useTheme();
  const motion = useMotion();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (!motion.pulse) {
      cancelAnimation(pulse);
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(
      withTiming(0.55, {
        duration: 700,
        // `ease-in-out` du CSS.
        easing: Easing.bezier(0.42, 0, 0.58, 1),
        reduceMotion: ReduceMotion.Never,
      }),
      -1,
      true,
      undefined,
      ReduceMotion.Never,
    );
    return () => cancelAnimation(pulse);
  }, [motion.pulse, pulse]);
  const a11y = busyA11y({ busy: true }, Platform.OS);
  return (
    <View
      accessible
      accessibilityLabel="Chargement"
      accessibilityState={a11y.state}
      accessibilityValue={a11y.value}
      style={{ gap: 12 }}
    >
      {kind === 'list' ? (
        Array.from({ length: rows }, (_, index) => (
          <Line key={index} pulse={pulse} widths={['46%', '72%']} />
        ))
      ) : (
        <>
          <Line pulse={pulse} widths={['38%', '24%']} />
          <View
            style={{
              gap: 6,
              padding: 8,
              borderRadius: radius.xl,
              borderWidth: border.ink,
              borderColor: colors['border-default'],
            }}
          >
            <Bar
              pulse={pulse}
              style={{ alignSelf: 'stretch', aspectRatio: 16 / 9, borderRadius: 14 }}
            />
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Block pulse={pulse} ratio={6 / 5} />
              <Block pulse={pulse} ratio={6 / 5} />
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Block pulse={pulse} ratio={1} />
              <Block pulse={pulse} ratio={1} />
              <Block pulse={pulse} ratio={1} />
            </View>
          </View>
        </>
      )}
    </View>
  );
}

/** Un bloc qui pulse avec les autres. */
function Bar({
  pulse,
  style,
}: {
  pulse: SharedValue<number>;
  style: {
    width?: DimensionValue;
    height?: number;
    flex?: number;
    alignSelf?: 'stretch';
    aspectRatio?: number;
    borderRadius: number;
  };
}) {
  const { colors } = useTheme();
  const breathing = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return <Animated.View style={[{ backgroundColor: colors.skeleton }, style, breathing]} />;
}

/** Une ligne : un rond de 44, deux traits de 12 aux largeurs du design. */
function Line({
  pulse,
  widths,
}: {
  pulse: SharedValue<number>;
  widths: [DimensionValue, DimensionValue];
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Bar pulse={pulse} style={{ width: 44, height: 44, borderRadius: 22 }} />
      <View style={{ flex: 1, gap: 8 }}>
        <Bar pulse={pulse} style={{ width: widths[0], height: 12, borderRadius: 6 }} />
        <Bar pulse={pulse} style={{ width: widths[1], height: 12, borderRadius: 6 }} />
      </View>
    </View>
  );
}

/** Une case d'une rangée du plateau, aux coins de 14, qui partage la largeur avec ses voisines. */
function Block({ pulse, ratio }: { pulse: SharedValue<number>; ratio: number }) {
  return <Bar pulse={pulse} style={{ flex: 1, aspectRatio: ratio, borderRadius: 14 }} />;
}
