import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsOffline } from '@/lib/use-is-offline';

/**
 * Banner rouge en haut d'écran quand le device est offline.
 *
 * Posé en absolute par-dessus la SafeArea pour rester visible quel que
 * soit l'écran courant (composer, la table, recherche…). S'auto-cache quand
 * la connexion revient.
 *
 * Occupe le haut de l'écran en `zIndex` 1000 : il passe devant le bandeau de
 * mise à jour, qui de son côté s'efface hors ligne. La détection réseau vit
 * dans `useIsOffline`, partagée entre les deux.
 */
export function OfflineBanner() {
  const offline = useIsOffline();
  const insets = useSafeAreaInsets();

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
