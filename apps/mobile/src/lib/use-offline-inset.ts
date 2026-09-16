import { useWindowDimensions } from 'react-native';
import { offlineBannerHeight } from '@/lib/offline-banner';
import { useIsOffline } from '@/lib/use-is-offline';

/**
 * Place à réserver en haut d'un écran pour le bandeau « Pas de connexion ».
 *
 * Nulle tant que l'appareil est en ligne : rien ne bouge. `YellowBg` la pose
 * pour tous les écrans qui s'en servent ; les deux modèles de mise en page, le
 * composer et la page publique, la comptent dans leur marge haute.
 */
export function useOfflineInset(): number {
  const offline = useIsOffline();
  const { fontScale } = useWindowDimensions();
  return offline ? offlineBannerHeight(fontScale) : 0;
}
