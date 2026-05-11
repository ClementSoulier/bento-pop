import { View } from 'react-native';
import type { ReactNode } from 'react';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';

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
 */
export function YellowBg({ children }: YellowBgProps) {
  return (
    <View style={{ flex: 1, backgroundColor: '#fbbf24' }}>
      <Svg
        width="100%"
        height="100%"
        style={{ position: 'absolute', inset: 0 }}
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
