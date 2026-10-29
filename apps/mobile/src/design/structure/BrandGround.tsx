import { StyleSheet, View, type ViewProps } from 'react-native';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';
import { useTheme } from '../theme';

export type BrandGroundProps = ViewProps & {
  /** Le rayon du fond, que les pois respectent. */
  radius?: number;
};

/**
 * Le fond des moments de marque (chantier 30) : le jaune `bg-brand` et ses
 * pois `bg-brand-dots`, un tous les 16 points, comme `.mbp-brand-ground`.
 * Les pois sont dessinés par un motif SVG arrondi comme le fond, si bien que
 * rien ne déborde sans couper les ombres des enfants.
 */
export function BrandGround({ radius = 0, style, children, ...props }: BrandGroundProps) {
  const { colors } = useTheme();
  return (
    <View {...props} style={[{ backgroundColor: colors['bg-brand'], borderRadius: radius }, style]}>
      <Svg
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Defs>
          <Pattern id="pois" width={16} height={16} patternUnits="userSpaceOnUse">
            <Circle cx={8} cy={8} r={1.85} fill={colors['bg-brand-dots']} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" rx={radius} fill="url(#pois)" />
      </Svg>
      {children}
    </View>
  );
}
