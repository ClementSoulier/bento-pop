import { Image, Text, View } from 'react-native';
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
  return (
    <YellowBg>
      <SafeAreaView style={{ flex: 1, paddingHorizontal: 24 }}>
        <View style={{ flex: 1, paddingTop: 24, paddingBottom: 16 }}>
          {/* Logo */}
          <View style={{ alignItems: 'center', marginTop: 24 }}>
            <Image source={logo} style={{ width: 180, height: 42 }} resizeMode="contain" />
          </View>

          {/* Hero typo */}
          <View style={{ alignItems: 'center', marginTop: 48 }}>
            <Sticker
              color="#0a0a0a"
              textColor="#fbbf24"
              rotation={-3}
              size={13}
              style={{ marginBottom: 14 }}
            >
              L'APP COMPANION
            </Sticker>
            <Text
              style={{
                fontFamily: 'Extenda',
                fontSize: 56,
                lineHeight: 49,
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
          <View style={{ flex: 1, position: 'relative', minHeight: 100 }}>
            <Image
              source={popyContent}
              style={{
                position: 'absolute',
                bottom: -20,
                left: '50%',
                marginLeft: -100,
                width: 200,
                height: 200,
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

          <StampButton wide onPress={() => router.push('/onboarding/pseudo')}>
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
