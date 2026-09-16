import { StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';
import { useOfflineInset } from '@/lib/use-offline-inset';

type YellowBgProps = {
  children?: ReactNode;
};

/**
 * Fond jaune signature Bento Pop avec motif de points noirs subtils (opacité
 * 0.08, espacement 20px). Reproduit le background dotted de la landing et
 * du design Claude Design.
 *
 * Le motif est fait en SVG (`<Pattern>`) plutôt qu'avec un background
 * pseudo-éléments car RN n'a pas l'équivalent CSS `background-image`.
 *
 * C'est aussi lui qui réserve la place du bandeau « Pas de connexion » quand
 * l'appareil est hors ligne : posé en absolu, le bandeau recouvrait sinon le
 * bouton retour de la page publique et le logo du composer. Le fond, lui, reste
 * peint sous le bandeau.
 */
export function YellowBg({ children }: YellowBgProps) {
  const offlineInset = useOfflineInset();
  return (
    <View style={{ flex: 1, backgroundColor: '#fbbf24', paddingTop: offlineInset }}>
      <Svg
        width="100%"
        height="100%"
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <Pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse">
            <Circle cx="2" cy="2" r="1.3" fill="rgba(10,10,10,0.08)" />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#dots)" />
      </Svg>
      {children}
    </View>
  );
}
