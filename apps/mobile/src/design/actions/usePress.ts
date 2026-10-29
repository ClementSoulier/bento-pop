import { useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { timingConfig, useMotion } from '../useMotion';

/**
 * L'appui d'un bouton du système : `pressed` va de 0 à 1 en 120 ms, et
 * revient au relâché ; immédiat quand le système réduit les animations. Les
 * boutons en tirent leur enfoncement, leur réduction ou leur fond, sans
 * confier leur style à une fonction de `pressed` (cf. `accessibilite.test.ts`).
 */
export function usePress(): {
  pressed: SharedValue<number>;
  onPressIn: () => void;
  onPressOut: () => void;
} {
  const motion = useMotion();
  const pressed = useSharedValue(0);
  const timing = timingConfig(motion.move('fast'));
  return {
    pressed,
    onPressIn: () => {
      pressed.value = withTiming(1, timing);
    },
    onPressOut: () => {
      pressed.value = withTiming(0, timing);
    },
  };
}
