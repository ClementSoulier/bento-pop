import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BentoGrid } from '@/components/bento';
import { Pagination, Sticker, StampButton, YellowBg } from '@/components/primitives';

/**
 * Onboarding 03 — Mécanique. Bento vide en demi-échelle avec deux
 * annotations en stamps (FILM PRÉFÉRÉ / UNE CHANSON), explication courte,
 * bouton « Je m'y mets ».
 *
 * Cf. design Claude Design — `MechanicsScreen` dans `screens.jsx`.
 */
export default function MechanicsOnboarding() {
  return (
    <YellowBg>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingTop: 16, paddingBottom: 16 }}>
          <View style={{ paddingHorizontal: 20 }}>
            <Sticker rotation={-3} style={{ marginBottom: 12 }}>
              6 CASES · 6 CHOIX
            </Sticker>
            <Text
              style={{
                fontFamily: 'Extenda',
                fontSize: 28,
                lineHeight: 26,
                letterSpacing: -0.3,
                color: '#0a0a0a',
                textTransform: 'uppercase',
              }}
            >
              {'Une boîte.\nSix envies.'}
            </Text>
          </View>

          {/* Bento demi-échelle + annotations */}
          <View style={{ paddingHorizontal: 32, marginTop: 20, position: 'relative' }}>
            <BentoGrid items={{}} scale={0.78} empty />

            {/* Annotation FILM PRÉFÉRÉ (cellule du haut, à droite) */}
            <View
              style={{
                position: 'absolute',
                top: 60,
                right: 14,
                backgroundColor: '#0a0a0a',
                borderWidth: 2,
                borderColor: '#0a0a0a',
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 4,
                transform: [{ rotate: '6deg' }],
              }}
            >
              <Text
                style={{
                  fontFamily: 'Bungee',
                  fontSize: 9,
                  letterSpacing: 1.2,
                  color: '#fbbf24',
                  textTransform: 'uppercase',
                }}
              >
                Film préféré
              </Text>
            </View>

            {/* Annotation UNE CHANSON (cellule petite, en bas à gauche) */}
            <View
              style={{
                position: 'absolute',
                bottom: 76,
                left: 14,
                backgroundColor: '#0a0a0a',
                borderWidth: 2,
                borderColor: '#0a0a0a',
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 4,
                transform: [{ rotate: '-5deg' }],
              }}
            >
              <Text
                style={{
                  fontFamily: 'Bungee',
                  fontSize: 9,
                  letterSpacing: 1.2,
                  color: '#fbbf24',
                  textTransform: 'uppercase',
                }}
              >
                Une chanson
              </Text>
            </View>
          </View>

          <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
            <Text
              style={{
                fontSize: 13,
                color: 'rgba(10,10,10,0.8)',
                textAlign: 'center',
                lineHeight: 19,
              }}
            >
              Touche une case, cherche, valide. Tu peux changer d'avis à tout moment. Quand le bento est plein, publie-le.
            </Text>
          </View>

          <View style={{ marginTop: 'auto', paddingHorizontal: 20 }}>
            <StampButton wide onPress={() => router.replace('/(tabs)/compose')}>
              Je m'y mets
            </StampButton>
            <View style={{ marginTop: 16 }}>
              <Pagination total={3} active={2} />
            </View>
          </View>
        </View>
      </SafeAreaView>
    </YellowBg>
  );
}
