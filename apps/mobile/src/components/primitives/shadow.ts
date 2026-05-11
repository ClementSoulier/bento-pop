import type { ViewStyle } from 'react-native';
import { Platform } from 'react-native';

/**
 * Helpers pour reproduire les ombres « stamp » de la DA Bento Pop en RN.
 *
 * iOS supporte les ombres plates via `shadowRadius: 0` (pas de flou).
 * Android n'a que `elevation` qui dessine une ombre standard floue — on
 * approxime avec une elevation raisonnable. La signature visuelle parfaite
 * est conservée sur iOS (cible principale), Android reste « propre ».
 */

const INK = '#0a0a0a';

export function stampShadow(offsetY = 4): ViewStyle {
  return Platform.select({
    ios: {
      shadowColor: INK,
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: 1,
      shadowRadius: 0,
    },
    android: {
      elevation: Math.max(2, Math.round(offsetY / 2)),
    },
    default: {
      // RN Web
      boxShadow: `0 ${offsetY}px 0 ${INK}` as unknown as string,
    },
  }) as ViewStyle;
}

export const SHADOWS = {
  stamp: stampShadow(4),
  stampLg: stampShadow(8),
  stampXl: stampShadow(10),
};
