import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { DURATION } from '../motion';
import { useTheme } from '../theme';
import type { PaletteToken } from '../tokens';
import { timingConfig, useMotion } from '../useMotion';

/**
 * Les 16 confettis du dossier (`code-source/src/index.jsx`) : départ en
 * pourcentage de la largeur et de la hauteur, couleur, déplacement en points,
 * rotation en degrés, et durée de chute du CSS, en secondes.
 */
const PIECES: readonly [number, number, PaletteToken, number, number, number, number][] = [
  [6, 4, 'yolk-300', 40, 260, 160, 2.2],
  [14, 10, 'ume-300', -30, 300, -200, 2.6],
  [22, 2, 'ramune-300', 20, 240, 120, 2.1],
  [31, 8, 'sakura-300', -10, 320, 220, 2.8],
  [40, 3, 'wasabi-300', 30, 260, -140, 2.3],
  [49, 12, 'shiso-300', -20, 300, 180, 2.7],
  [58, 5, 'yolk-300', 10, 280, -220, 2.4],
  [67, 9, 'thon-300', -40, 250, 200, 2.5],
  [75, 2, 'ume-300', 25, 330, -160, 2.9],
  [83, 7, 'ramune-300', -15, 270, 140, 2.2],
  [91, 4, 'sakura-300', 35, 300, -200, 2.6],
  [96, 11, 'yolk-300', -25, 260, 160, 2.3],
  [10, 18, 'shiso-300', 15, 220, 120, 2.0],
  [36, 16, 'thon-300', -35, 240, -120, 2.4],
  [62, 19, 'wasabi-300', 20, 230, 190, 2.1],
  [88, 17, 'ume-300', -10, 210, -160, 2.5],
];

/** Une durée de chute du CSS, en secondes, ramenée aux 600 ms d'une célébration ; la moyenne, 2,4 s, y tombe juste. */
const fallDuration = (seconds: number) => Math.round((DURATION.celebrate * seconds) / 2.4);

/** La plus longue chute, après laquelle la pluie s'efface. */
const LONGEST = Math.max(...PIECES.map((piece) => fallDuration(piece[6])));

export type ConfettiProps = {
  /** Une fois tombés et effacés, ou tout de suite sans animations : le parent peut les retirer. */
  onDone?: () => void;
};

/**
 * La pluie de confettis d'une célébration : publication du bento, bento
 * complet, succès (chantier 30, famille des calques et des retours). À poser
 * dans un parent positionné, qu'elle couvre sans recevoir le toucher.
 *
 * Elle tombe une fois, à son montage : un nouvel événement la remonte, sous
 * une autre `key`. Chaque confetti suit sa trajectoire du dossier sur la
 * courbe des déplacements ; les durées du CSS, de 2 à 2,9 s, sont ramenées
 * aux 600 ms que le README donne aux confettis, écarts gardés, de 500 à
 * 725 ms (D20). Puis la pluie s'efface en 120 ms. Rien quand le système
 * réduit les animations. Le retour haptique de succès qui l'accompagne
 * revient à l'écran, comme toute l'haptique (D11).
 */
export function Confetti({ onDone }: ConfettiProps) {
  const motion = useMotion();
  const shown = useSharedValue(1);
  useEffect(() => {
    if (!motion.confetti) {
      onDone?.();
      return;
    }
    shown.value = withDelay(
      LONGEST,
      withTiming(0, timingConfig(motion.fade('fast')), (finished) => {
        if (finished && onDone) scheduleOnRN(onDone);
      }),
      ReduceMotion.Never,
    );
    // Une fois, au montage : une nouvelle pluie est un nouveau montage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const fading = useAnimatedStyle(() => ({ opacity: shown.value }));
  if (!motion.confetti) return null;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { overflow: 'hidden' }, fading]}
    >
      {PIECES.map((piece, index) => (
        <Piece key={index} piece={piece} round={index % 3 === 0} />
      ))}
    </Animated.View>
  );
}

/** Un confetti : 12 sur 20 aux coins de 3, un sur trois rond de 12, cerné d'encre. */
function Piece({
  piece: [x, y, color, dx, dy, turn, seconds],
  round,
}: {
  piece: (typeof PIECES)[number];
  round: boolean;
}) {
  const { palette } = useTheme();
  const fall = useSharedValue(0);
  useEffect(() => {
    fall.value = withTiming(
      1,
      timingConfig({ duration: fallDuration(seconds), curve: 'standard' }),
    );
  }, [fall, seconds]);
  const falling = useAnimatedStyle(() => ({
    transform: [
      { translateX: dx * fall.value },
      { translateY: -40 + (dy + 40) * fall.value },
      { rotate: `${turn * fall.value}deg` },
    ],
  }));
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: `${x}%`,
          top: `${y}%`,
          width: 12,
          height: round ? 12 : 20,
          borderRadius: round ? 6 : 3,
          borderWidth: 1.5,
          borderColor: palette['nori-900'],
          backgroundColor: palette[color],
        },
        falling,
      ]}
    />
  );
}
