import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * Vrai quand le device n'a pas d'accès internet.
 *
 * Partagé par `OfflineBanner` et `UpdateBanner`, qui se disputeraient sinon
 * le haut de l'écran. Plutôt que de les coupler entre eux, chacun lit l'état
 * réseau ; le bandeau de mise à jour s'efface hors ligne, parce que proposer
 * d'aller sur le store sans connexion ne mène nulle part.
 *
 * NetInfo écoute les changements réseau natifs (`Reachability` sur iOS,
 * `ConnectivityManager` sur Android, `navigator.onLine` sur web).
 */
export function useIsOffline(): boolean {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      // `isInternetReachable` peut être null pendant la 1ère eval → tolérant
      const reachable = state.isInternetReachable !== false;
      setOffline(!state.isConnected || !reachable);
    });
    return unsub;
  }, []);

  return offline;
}
