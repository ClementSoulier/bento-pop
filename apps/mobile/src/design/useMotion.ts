import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';
import {
  Easing,
  ReduceMotion,
  useReducedMotion,
  type WithTimingConfig,
} from 'react-native-reanimated';
import { CURVE, motionFor, type Motion, type Timing } from './motion';

/**
 * Le réglage « réduire les animations », suivi en direct (chantier 30, D10).
 *
 * `useReducedMotion` de Reanimated ne le lit qu'au lancement : le changer app
 * ouverte n'aurait d'effet qu'au suivant. `AccessibilityInfo` le suit sur iOS
 * comme sur Android, où il répond à l'échelle des transitions mise à zéro.
 * Une seule écoute pour toute l'app ; la valeur du lancement tient lieu tant
 * que le système n'a pas répondu.
 */
let reducedNow: boolean | null = null;
const listeners = new Set<() => void>();
let listening = false;

function update(reduced: boolean) {
  if (reduced === reducedNow) return;
  reducedNow = reduced;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!listening) {
    listening = true;
    AccessibilityInfo.addEventListener('reduceMotionChanged', update);
    void AccessibilityInfo.isReduceMotionEnabled().then(update, () => {});
  }
  return () => {
    listeners.delete(listener);
  };
}

const MOTION = { full: motionFor(false), reduced: motionFor(true) };

/** Le mouvement du design system, réduit quand le système le demande. */
export function useMotion(): Motion {
  const atLaunch = useReducedMotion();
  const reduced = useSyncExternalStore(subscribe, () => reducedNow ?? atLaunch);
  return reduced ? MOTION.reduced : MOTION.full;
}

const EASING = {
  standard: Easing.bezier(...CURVE.standard),
  pop: Easing.bezier(...CURVE.pop),
  exit: Easing.bezier(...CURVE.exit),
};

/**
 * La configuration de `withTiming` pour une animation de `useMotion()`, qui a
 * déjà appliqué le réglage du système : Reanimated, qui ne le lit qu'au
 * lancement, ne doit pas l'appliquer une seconde fois.
 */
export function timingConfig({ duration, curve }: Timing): WithTimingConfig {
  return { duration, easing: EASING[curve], reduceMotion: ReduceMotion.Never };
}
