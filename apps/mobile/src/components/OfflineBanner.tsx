import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';

/**
 * Banner rouge en haut d'écran quand le device est offline.
 *
 * Posé en absolute par-dessus la SafeArea pour rester visible quel que
 * soit l'écran courant (composer, featured, search…). S'auto-cache quand
 * la connexion revient.
 *
 * NetInfo écoute les changements réseau natifs (`Reachability` sur iOS,
 * `ConnectivityManager` sur Android, `navigator.onLine` sur web).
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      // `isInternetReachable` peut être null pendant la 1ère eval → tolérant
      const reachable = state.isInternetReachable !== false;
      setOffline(!state.isConnected || !reachable);
    });
    return unsub;
  }, []);

  if (!offline) return null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        paddingTop: insets.top,
        backgroundColor: '#e63946',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 6,
          gap: 8,
        }}
      >
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: '#ffffff',
          }}
        />
        <Text
          style={{
            fontFamily: 'Bungee',
            fontSize: 10,
            letterSpacing: 1.5,
            color: '#ffffff',
            textTransform: 'uppercase',
          }}
        >
          Pas de connexion
        </Text>
      </View>
    </View>
  );
}
