import { router } from 'expo-router';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Display, Logo, Popy, Screen, Steps, Sticker, Text } from '@/design';

/**
 * En dessous de cette hauteur, celle d'un iPhone SE, Popy passe au bas de sa
 * fourchette de moment de marque : l'accueil y tient alors sans défiler, à la
 * taille de texte par défaut.
 */
const SHORT_SCREEN = 720;

/**
 * L'accueil, étape 1 sur 3 (`p01-accueil`, chantier 31).
 *
 * Les boutons ne sortent jamais de l'écran : le contenu défile au-dessus
 * d'eux dès que le texte du système ne le laisse plus tenir (chantier 11).
 */
export default function SplashOnboarding() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  return (
    <Screen tone="brand">
      <View style={{ paddingTop: 8, paddingBottom: 8, paddingHorizontal: 16 }}>
        <Steps count={3} index={0} />
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}
      >
        <View style={{ alignItems: 'center', paddingTop: 14 }}>
          <Logo height={40} />
        </View>
        <View style={{ alignItems: 'center', paddingTop: 18, paddingBottom: 8 }}>
          <Popy mood="content" size={height < SHORT_SCREEN ? 150 : 176} wiggle />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', paddingBottom: 14 }}>
          <Sticker label="L’app companion" tilt={-3} />
        </View>
        <Display text={'Compose\nton bento'} outline="pop culture." align="center" />
        <Text variant="body-l" style={{ marginTop: 16, paddingHorizontal: 12, textAlign: 'center' }}>
          Ton film, ta série, ton artiste, ton lieu de cœur : six cases, une carte de visite
          culturelle.
        </Text>
      </ScrollView>
      <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 12, gap: 2 }}>
        <Button
          variant="on-brand"
          block
          label="Commencer"
          onPress={() => router.push('/onboarding/terms')}
        />
        {/* Chantier 28 : le premier écran d'un téléphone neuf, ou d'une
            réinstallation. Un compte gardé se retrouve d'ici. */}
        <Button
          variant="tertiary"
          size="md"
          label="J’ai déjà un compte"
          style={{ alignSelf: 'center' }}
          onPress={() => router.push('/account/sign-in')}
        />
      </View>
    </Screen>
  );
}
