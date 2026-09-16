import { PixelRatio, Platform, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BentoGrid } from '@/components/bento';
import {
  CONTENT_MAX_FONT_MULTIPLIER,
  TITLE_MAX_FONT_MULTIPLIER,
  scaledType,
} from '@/components/bento/font-scaling';
import { Pagination, Sticker, StampButton, YellowBg } from '@/components/primitives';
import { displayTitleScale, extendaAccentRoom } from '@/lib/display-title';

const SIDE_PADDING = 20;
const TITLE = 'Une boîte.\nSix envies.';
const TITLE_LETTER_SPACING = -0.3;

/**
 * Onboarding 03 — Mécanique. Bento vide en demi-échelle avec deux
 * annotations en stamps (FILM PRÉFÉRÉ / UNE CHANSON), explication courte,
 * bouton « Je m'y mets ».
 *
 * Cf. design Claude Design — `MechanicsScreen` dans `screens.jsx`.
 *
 * Le contenu défile au-dessus du bouton, qui reste en bas : sans défilement, le
 * bouton sortait de l'écran d'un iPhone 17 Pro dès la taille AX2. Tant que tout
 * tient, la mise en page est celle d'avant. Le titre réserve la place de
 * l'accent de « BOÎTE », que son interligne rognait à la taille par défaut.
 */
export default function MechanicsOnboarding() {
  const { fontScale, width } = useWindowDimensions();
  const capped = scaledType(fontScale, TITLE_MAX_FONT_MULTIPLIER, 28, 26);
  const shrink = displayTitleScale(
    TITLE,
    width - SIDE_PADDING * 2,
    capped.fontSize,
    TITLE_LETTER_SPACING,
    Platform.OS === 'android' ? PixelRatio.get() : undefined,
  );
  const accentRoom = extendaAccentRoom(TITLE, capped.fontSize * shrink);

  return (
    <YellowBg>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingTop: 16, paddingBottom: 16 }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            alwaysBounceVertical={false}
          >
            <View style={{ paddingHorizontal: SIDE_PADDING }}>
              <Sticker rotation={-3} style={{ marginBottom: 12 }}>
                6 CASES · 6 CHOIX
              </Sticker>
              <Text
                allowFontScaling={false}
                // Android : passer à la ligne entre deux mots, jamais au milieu.
                textBreakStrategy="simple"
                style={{
                  fontFamily: 'Extenda',
                  fontSize: capped.fontSize * shrink,
                  lineHeight: capped.lineHeight * shrink,
                  letterSpacing: TITLE_LETTER_SPACING,
                  color: '#0a0a0a',
                  textTransform: 'uppercase',
                  paddingTop: accentRoom,
                  marginTop: -accentRoom,
                }}
              >
                {TITLE}
              </Text>
            </View>

            {/* Bento demi-échelle + annotations */}
            <View style={{ paddingHorizontal: 32, marginTop: 20, position: 'relative' }}>
              <BentoGrid items={{}} scale={0.78} empty />

              {/* Annotation FILM PRÉFÉRÉ (cellule du haut, à droite). Posée sur le
                  dessin de la boîte, à échelle fixe : sa police ne suit pas. */}
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
                  allowFontScaling={false}
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
                  allowFontScaling={false}
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

            <View style={{ paddingHorizontal: 24, marginTop: 24, marginBottom: 24 }}>
              <Text
                allowFontScaling={false}
                style={{
                  ...scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, 13, 19),
                  color: 'rgba(10,10,10,0.8)',
                  textAlign: 'center',
                }}
              >
                Touche une case, cherche, valide. Tu peux changer d'avis à tout moment. Quand le bento est plein, publie-le.
              </Text>
            </View>
          </ScrollView>

          <View style={{ paddingHorizontal: 20 }}>
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
