import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '../Text';
import { useTheme } from '../theme';

export type BadgeProps = {
  count?: number;
  /** Une pastille sans nombre. */
  dot?: boolean;
  /** Seulement si rien autour ne dit ce que compte la pastille. */
  label?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * La pastille d'un compteur (chantier 30, famille des calques) : 18 de haut,
 * rouge `danger`, cerclée de 2 de la couleur de la barre qui la porte, au-delà
 * de 99 « 99+ ». Le cerne est un contour : la pastille mesure 22, et son
 * parent la place 2 plus haut et plus à gauche que le design.
 *
 * Son texte est celui des onglets, fixe à 130 % : elle se pose sur une icône,
 * dans une barre dont la hauteur ne bouge pas.
 */
export function Badge({ count = 0, dot, label, style }: BadgeProps) {
  const { colors } = useTheme();
  const accessibility = label
    ? { accessible: true, accessibilityLabel: label }
    : {
        accessible: false,
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants' as const,
      };
  const ring = { borderWidth: 2, borderColor: colors['tabbar-bg'], backgroundColor: colors.danger };
  if (dot) {
    return (
      <View {...accessibility} style={[ring, { width: 14, height: 14, borderRadius: 7 }, style]} />
    );
  }
  return (
    <View
      {...accessibility}
      style={[
        ring,
        {
          minWidth: 22,
          height: 22,
          paddingHorizontal: 5,
          borderRadius: 11,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text
        variant="tab-label"
        weight={700}
        color="on-danger"
        numberOfLines={1}
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {count > 99 ? '99+' : String(count)}
      </Text>
    </View>
  );
}
