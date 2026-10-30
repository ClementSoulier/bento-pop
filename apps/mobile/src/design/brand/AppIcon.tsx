import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { PopyImage } from './PopyImage';

export type AppIconProps = {
  /** En points, 40 par défaut. */
  size?: number;
};

/**
 * L'icône de l'app dessinée dans l'app (chantier 30, famille de la marque) :
 * Popy content sur `yolk-500`, coins arrondis au quart, un filet d'encre à
 * 12 %. L'icône du système, elle, change au 31.
 */
export function AppIcon({ size = 40 }: AppIconProps) {
  const { colors, palette } = useTheme();
  const radius = size * 0.26;
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: palette['yolk-500'],
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <PopyImage mood="content" size={size * 0.84} style={{ marginTop: size * 0.06 }} />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: radius, borderWidth: 1, borderColor: colors.ink, opacity: 0.12 },
        ]}
      />
    </View>
  );
}
