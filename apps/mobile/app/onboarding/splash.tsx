import { Image, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import logo from '@bento-pop/brand/assets/logo/bento-pop.png';
import popyContent from '@bento-pop/brand/assets/mascot/popy-content.png';
import { Pagination, Sticker, StampButton, YellowBg } from '@/components/primitives';

/**
 * Onboarding 01 — Splash. Logo + sticker « L'APP COMPANION » + headline +
 * Popy Content + bouton « Commencer » + pagination (1/3 actif).
 *
 * Cf. design Claude Design — `SplashScreen` dans `screens.jsx`.
 */
export default function SplashOnboarding() {
  // Adapte le titre et le Popy aux écrans courts (iPad lance l'app en
  // compat-mode iPhone à 375×667pt — beaucoup moins de hauteur qu'un
  // iPhone moderne à 852pt — le layout par défaut faisait alors
  // chevaucher le Popy avec le titre).
  const { height } = useWindowDimensions();
  const isShort = height < 720;
  const titleSize = isShort ? 44 : 56;
  const titleLineHeight = isShort ? 46 : 58;
  const popySize = isShort ? 140 : 200;
  const heroMarginTop = isShort ? 24 : 48;

  return (
    <YellowBg>
      <SafeAreaView style={{ flex: 1, paddingHorizontal: 24 }}>
        <View style={{ flex: 1, paddingTop: 24, paddingBottom: 16 }}>
          {/* Logo */}
          <View style={{ alignItems: 'center', marginTop: 24 }}>
            <Image source={logo} style={{ width: 180, height: 42 }} resizeMode="contain" />
          </View>

          {/* Hero typo */}
          <View style={{ alignItems: 'center', marginTop: heroMarginTop }}>
            <Sticker
              color="#0a0a0a"
              textColor="#fbbf24"
              rotation={-3}
              size={13}
              style={{ marginBottom: 24 }}
            >
              L'APP COMPANION
            </Sticker>
            <Text
              style={{
                fontFamily: 'Extenda',
                fontSize: titleSize,
                // Leading >= fontSize : sinon le haut des glyphes de la 1re
                // ligne « COMPOSE » est crop par le marginBottom du sticker.
                lineHeight: titleLineHeight,
                letterSpacing: -1,
                textAlign: 'center',
                textTransform: 'uppercase',
                color: '#0a0a0a',
              }}
            >
              {'Compose\nton bento\n'}
              <Text style={{ color: '#e63946' }}>pop culture.</Text>
            </Text>
          </View>

          {/* Popy */}
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'flex-end',
            }}
          >
            <Image
              source={popyContent}
              style={{
                width: popySize,
                height: popySize,
                marginBottom: -20,
                transform: [{ rotate: '-3deg' }],
              }}
              resizeMode="contain"
            />
          </View>

          <Text
            style={{
              textAlign: 'center',
              fontSize: 14,
              color: 'rgba(10,10,10,0.75)',
              maxWidth: 280,
              alignSelf: 'center',
              marginBottom: 24,
              lineHeight: 20,
            }}
          >
            Ton film, ta série, ton artiste, ton lieu de cœur — six cases, une carte de visite culturelle.
          </Text>

          <StampButton wide onPress={() => router.push('/onboarding/terms')}>
            Commencer
          </StampButton>

          <View style={{ marginTop: 16 }}>
            <Pagination total={3} active={0} />
          </View>
        </View>
      </SafeAreaView>
    </YellowBg>
  );
}
