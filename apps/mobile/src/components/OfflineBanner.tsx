import { AccessibilityInfo, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef } from 'react';
import { connectionAnnouncement } from '@/lib/announce';
import { useIsOffline } from '@/lib/use-is-offline';
import { OFFLINE_BANNER_PADDING, offlineBannerHeight } from '@/lib/offline-banner';
import {
  CONTROL_MAX_FONT_MULTIPLIER,
  naturalLineHeight,
  scaledType,
} from '@/components/bento/font-scaling';

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
  // Le bandeau apparaît et disparaît tout seul : il s'annonce, dans les deux
  // sens. Le premier rendu ne dit rien, il ne raconte aucun changement.
  const previous = useRef(offline);
  useEffect(() => {
    if (previous.current === offline) return;
    previous.current = offline;
    AccessibilityInfo.announceForAccessibility(connectionAnnouncement(offline));
  }, [offline]);
  // Hauteur de ligne posée et police appliquée par le bandeau : sa hauteur est la
  // même sur les deux plateformes, et plafonnée.
  const { fontScale } = useWindowDimensions();
  const type = scaledType(
    fontScale,
    CONTROL_MAX_FONT_MULTIPLIER,
    10,
    naturalLineHeight('Bungee', 10),
  );

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
      {/* Hauteur du modèle, celle que les écrans réservent : cf. `useOfflineInset`. */}
      <View
        style={{
          height: offlineBannerHeight(fontScale),
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: OFFLINE_BANNER_PADDING,
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
          allowFontScaling={false}
          numberOfLines={1}
          style={{
            fontFamily: 'Bungee',
            ...type,
            letterSpacing: 1.5,
            color: '#ffffff',
            textTransform: 'uppercase',
            includeFontPadding: false,
          }}
        >
          Pas de connexion
        </Text>
      </View>
    </View>
  );
}
