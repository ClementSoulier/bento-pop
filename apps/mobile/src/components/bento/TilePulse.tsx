import { useEffect, type ReactNode } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

/**
 * Pulsation courte de la case qui vient d'être remplie.
 *
 * Le seul retour visuel du remplissage était la disparition de la modale :
 * la tuile apparaissait déjà en place, sans que rien ne désigne ce qui avait
 * changé.
 *
 * `trigger` plutôt qu'un booléen : remplacer deux fois de suite l'item d'une
 * même case laisserait un booléen à `true` et ne rejouerait pas l'animation.
 * Un compteur qui change à chaque pose le garantit.
 *
 * Volontairement courte et de faible amplitude. Le chantier 2 a laissé
 * ouverte une question de fluidité sur les écrans à grille, et une animation
 * de 260 ms sur une seule tuile est ce qui coûte le moins pour ce qu'elle
 * apporte.
 */

const UP_MS = 110;
const DOWN_MS = 150;
const PEAK = 1.04;

export function TilePulse({
  trigger,
  children,
}: {
  /** Change à chaque pose. `null` ne déclenche rien. */
  trigger: number | null;
  children: ReactNode;
}) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (trigger === null) return;
    scale.value = withSequence(
      withTiming(PEAK, { duration: UP_MS, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: DOWN_MS, easing: Easing.out(Easing.quad) }),
    );
  }, [trigger, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return <Animated.View style={style}>{children}</Animated.View>;
}
