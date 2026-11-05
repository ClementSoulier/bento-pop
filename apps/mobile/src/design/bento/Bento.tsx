import { useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { PopShadow } from '../PopShadow';
import { useTheme } from '../theme';
import { BENTO_ROWS, emptyBentoLabel, tileMinHeights } from './bento-rules';
import { BentoTile } from './BentoTile';

export type BentoProps = {
  /** Ce que lit le lecteur d'écran à la place des six cases. */
  label?: string;
};

/**
 * Le plateau de six cases (chantier 31, D3), vide et en densité `compose` :
 * le seul objet de l'écran qui porte le contour encre et l'ombre franche.
 *
 * Il prend la largeur que son parent lui laisse ; avant sa première mesure, il
 * compte sur la largeur de l'écran moins ses marges, ce qui évite un saut de
 * hauteur à l'arrivée. Le chantier 32 le complète : les cases remplies, les
 * questions d'une édition et les densités `feed`, `mini` et `share`.
 */
export function Bento({ label = emptyBentoLabel() }: BentoProps) {
  const { colors, border, radius, size } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const [width, setWidth] = useState<number>();
  const heights = tileMinHeights(width ?? windowWidth - 2 * size['screen-margin']);
  return (
    <PopShadow
      level="pop-lg"
      radius={radius.xl}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          gap: size['plate-gap'],
          padding: size['plate-padding'],
          borderRadius: radius.xl,
          borderWidth: border.ink,
          borderColor: colors['plate-outline'],
          backgroundColor: colors['bg-plate'],
        }}
      >
        {BENTO_ROWS.map((row) => (
          <View key={row[0]?.category} style={{ flexDirection: 'row', gap: size['plate-gap'] }}>
            {row.map((tile) => (
              <BentoTile
                key={tile.category}
                category={tile.category}
                size={tile.size}
                minHeight={heights[tile.size]}
              />
            ))}
          </View>
        ))}
      </View>
    </PopShadow>
  );
}
