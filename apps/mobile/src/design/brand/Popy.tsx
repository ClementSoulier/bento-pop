import { useEffect } from 'react';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { timingConfig, useMotion } from '../useMotion';
import type { Mood } from './popy-images';
import { PopyImage } from './PopyImage';

export type PopyProps = {
  mood?: Mood;
  /** En points : 52 à 64 dans une carte, 76 dans une boîte de dialogue, 88 à 120 dans un parcours, 150 à 190 dans un moment de marque. */
  size?: number;
  /** En degrés, de -10 à 10. */
  tilt?: number;
  /** Le dandinement au repos, arrêté quand le système réduit les animations. */
  wiggle?: boolean;
  /** Seulement si l'image dit ce que le texte voisin ne dit pas. */
  alt?: string;
};

/**
 * La mascotte, dans l'humeur du moment (chantier 30, famille de la marque).
 * Décorative par défaut. Le dandinement est celui du design : de -2 à 3 degrés
 * et retour en 2,4 s, autour d'un point aux quatre cinquièmes de sa hauteur.
 */
export function Popy({ mood = 'content', size = 120, tilt = 0, wiggle, alt }: PopyProps) {
  const motion = useMotion();
  const sways = Boolean(wiggle) && motion.wiggle;
  const sway = useSharedValue(0);
  useEffect(() => {
    if (!sways) {
      cancelAnimation(sway);
      sway.value = 0;
      return;
    }
    sway.value = 0;
    sway.value = withRepeat(
      withTiming(1, timingConfig({ duration: 1200, curve: 'standard' })),
      -1,
      true,
    );
    return () => cancelAnimation(sway);
  }, [sways, sway]);
  const rotation = useAnimatedStyle(() => ({
    transform: [{ rotate: `${tilt + (sways ? -2 + 5 * sway.value : 0)}deg` }],
  }));
  const accessibility = alt
    ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel: alt }
    : {
        accessible: false,
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants' as const,
      };
  return (
    <Animated.View
      {...accessibility}
      style={[{ width: size, height: size, transformOrigin: '50% 80%' }, rotation]}
    >
      <PopyImage mood={mood} size={size} />
    </Animated.View>
  );
}
