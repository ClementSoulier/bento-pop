import { useState } from 'react';
import { router } from 'expo-router';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bento,
  Button,
  Display,
  Screen,
  Steps,
  Sticker,
  Text,
  illustrationScale,
  plateMinHeight,
} from '@/design';

/**
 * Autour du plateau, à la taille de texte par défaut : les étapes (20),
 * l'autocollant (42), l'affiche (72), les deux marges du plateau et la phrase
 * (105), le bas de la zone qui défile (12), le bouton et sa marge (64).
 */
const AROUND_PLATE = 315;
const SIDE_MARGIN = 16;

/**
 * Les six cases, étape 3 sur 3 (`p03-six-cases`, chantier 31). Le bento y est
 * une illustration : il se lit d'un seul libellé, et ses deux autocollants se
 * taisent.
 *
 * La maquette dépasse de son cadre de 7 points, et sa phrase touche le bouton :
 * les marges au-dessus du plateau et de la phrase sont resserrées de 19 points
 * pour que tout tienne à l'iPhone 17 Pro (D16). Sur un écran plus court, le
 * plateau rapetisse, autocollants compris, plutôt que de cacher la phrase sous
 * le bouton. Au-delà, quand le texte du système monte, le contenu défile
 * au-dessus du bouton, qui ne sort jamais de l'écran.
 */
export default function MechanicsOnboarding() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [plateHeight, setPlateHeight] = useState(plateMinHeight(width - 2 * SIDE_MARGIN));
  const scale = illustrationScale(height - insets.top - insets.bottom - AROUND_PLATE, plateHeight);
  return (
    <Screen tone="brand">
      <View style={{ paddingTop: 8, paddingBottom: 8, paddingHorizontal: SIDE_MARGIN }}>
        <Steps count={3} index={2} />
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: SIDE_MARGIN, paddingBottom: 12 }}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}
      >
        <View style={{ flexDirection: 'row', paddingTop: 10 }}>
          <Sticker label="6 cases · 6 choix" tilt={-3} />
        </View>
        <View style={{ paddingTop: 12 }}>
          <Display text={'Une boîte.\nSix envies.'} size="l" />
        </View>
        <View style={{ marginTop: 16, height: plateHeight * scale }}>
          <View
            onLayout={(event) => setPlateHeight(event.nativeEvent.layout.height)}
            style={{ transform: [{ scale }], transformOrigin: 'top center' }}
          >
            <Bento />
            <View
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{ position: 'absolute', right: -6, top: 38 }}
            >
              <Sticker label="Film préféré" tone="rice" tilt={6} />
            </View>
            <View
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{ position: 'absolute', left: -8, bottom: 96 }}
            >
              <Sticker label="Une chanson" tone="rice" tilt={-5} />
            </View>
          </View>
        </View>
        <Text variant="body-l" style={{ marginTop: 17, textAlign: 'center' }}>
          Touche une case, cherche, valide. Tu peux changer d’avis à tout moment. Quand le bento est
          plein, publie-le.
        </Text>
      </ScrollView>
      <View style={{ paddingHorizontal: SIDE_MARGIN, paddingBottom: insets.bottom + 12 }}>
        <Button
          variant="on-brand"
          block
          label="Je m’y mets"
          onPress={() => router.replace('/(tabs)/compose')}
        />
      </View>
    </Screen>
  );
}
