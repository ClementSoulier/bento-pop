import { useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, useTheme } from '@/design';

/**
 * Une page du catalogue du design system v2 (chantier 30, D12), réservé au
 * développement : son titre, puis chaque composant sous le nom de son aperçu,
 * dans les états de celui-ci, aux mesures du design (un point pour un pixel de
 * l'aperçu). `?only=Button` n'en montre qu'un, en haut de la page, pour le
 * capturer d'un seul écran.
 */
export function CataloguePage({ title, children }: { title: string; children: ReactNode }) {
  const { colors, space } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors['bg-app'] }}
      contentContainerStyle={{
        paddingTop: insets.top + space[4],
        paddingBottom: insets.bottom + space[8],
        gap: space[8],
      }}
    >
      <Text variant="title-1" accessibilityRole="header" style={{ paddingHorizontal: space[4] }}>
        {title}
      </Text>
      {children}
    </ScrollView>
  );
}

/**
 * Un composant du catalogue, sous le nom de son dossier dans le design. `bleed`
 * le pose bord à bord, pour une barre qui prend toute la largeur.
 */
export function Specimen({
  name,
  bleed,
  style,
  children,
}: {
  name: string;
  bleed?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const { space } = useTheme();
  const { only } = useLocalSearchParams<{ only?: string }>();
  if (only && only !== name) return null;
  return (
    <View style={{ gap: space[3] }}>
      <Text variant="title-3" accessibilityRole="header" style={{ paddingHorizontal: space[4] }}>
        {name}
      </Text>
      <View style={[{ gap: space[3], paddingHorizontal: bleed ? 0 : space[4] }, style]}>
        {children}
      </View>
    </View>
  );
}
