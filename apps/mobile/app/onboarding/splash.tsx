import { useState } from 'react';
import {
  Image,
  PixelRatio,
  Platform,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import logo from '@bento-pop/brand/assets/logo/bento-pop.png';
import popyContent from '@bento-pop/brand/assets/mascot/popy-content.png';
import {
  CONTENT_MAX_FONT_MULTIPLIER,
  TITLE_MAX_FONT_MULTIPLIER,
  scaledType,
} from '@/components/bento/font-scaling';
import { Pagination, Sticker, StampButton, YellowBg } from '@/components/primitives';
import { displayTitleScale, extendaAccentRoom } from '@/lib/display-title';

/** Marge de chaque côté de l'écran. */
const SIDE_PADDING = 24;
const TITLE = 'Compose\nton bento\npop culture.';
const TITLE_LETTER_SPACING = -1;

/**
 * Onboarding 01 — Splash. Logo + sticker « L'APP COMPANION » + headline +
 * Popy Content + bouton « Commencer » + pagination (1/3 actif).
 *
 * Cf. design Claude Design — `SplashScreen` dans `screens.jsx`.
 *
 * **Le bouton ne sort jamais de l'écran.** Le contenu défile au-dessus de lui,
 * qui reste en bas. Avant le chantier 11, le bouton était posé sous un contenu
 * qui ne défilait pas : dès la plus grande taille standard du réglage Taille du
 * texte, il sortait de l'écran d'un iPhone 17 Pro, et l'on ne pouvait plus
 * commencer. Tant que tout tient, `flexGrow` garde la mise en page d'avant.
 */
export default function SplashOnboarding() {
  // Adapte le titre et le Popy aux écrans courts (iPad lance l'app en
  // compat-mode iPhone à 375×667pt — beaucoup moins de hauteur qu'un
  // iPhone moderne à 852pt — le layout par défaut faisait alors
  // chevaucher le Popy avec le titre).
  const { height, width, fontScale } = useWindowDimensions();
  // Place laissée à la mascotte, mesurée au rendu : elle ne dépend pas de
  // l'image, posée en absolu, donc la cacher ne relance pas la mise en page.
  const [popyRoom, setPopyRoom] = useState<number | null>(null);
  const isShort = height < 720;
  const titleSize = isShort ? 44 : 56;
  const titleLineHeight = isShort ? 46 : 58;
  const popySize = isShort ? 140 : 200;
  const heroMarginTop = isShort ? 24 : 48;

  // Le titre suit la police jusqu'à son plafond, et rétrécit si un mot ne tient
  // plus sur la ligne : « COMPOS / E » à xxLarge sur un 17 Pro.
  const capped = scaledType(fontScale, TITLE_MAX_FONT_MULTIPLIER, titleSize, titleLineHeight);
  const shrink = displayTitleScale(
    TITLE,
    width - SIDE_PADDING * 2,
    capped.fontSize,
    TITLE_LETTER_SPACING,
    Platform.OS === 'android' ? PixelRatio.get() : undefined,
  );
  const titleFontSize = capped.fontSize * shrink;
  const accentRoom = extendaAccentRoom(TITLE, titleFontSize);

  return (
    <YellowBg>
      <SafeAreaView style={{ flex: 1, paddingHorizontal: SIDE_PADDING }}>
        <View style={{ flex: 1, paddingTop: 24, paddingBottom: 16 }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            alwaysBounceVertical={false}
          >
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
                allowFontScaling={false}
                // Android : passer à la ligne entre deux mots, jamais au milieu.
                textBreakStrategy="simple"
                style={{
                  fontFamily: 'Extenda',
                  fontSize: titleFontSize,
                  // Leading >= fontSize : sinon le haut des glyphes de la 1re
                  // ligne « COMPOSE » est crop par le marginBottom du sticker.
                  lineHeight: capped.lineHeight * shrink,
                  letterSpacing: TITLE_LETTER_SPACING,
                  textAlign: 'center',
                  textTransform: 'uppercase',
                  color: '#0a0a0a',
                  paddingTop: accentRoom,
                  marginTop: -accentRoom,
                }}
              >
                {'Compose\nton bento\n'}
                <Text style={{ color: '#e63946' }}>pop culture.</Text>
              </Text>
            </View>

            {/* Popy occupe la place qui reste, et rien de plus. L'image est
                posée en absolu, au bas de cette place : dans le flux, ses 180 pt
                de hauteur l'emportaient sur les 177 disponibles sur un 17 Pro, et
                faisaient défiler l'écran de 3 pt à la taille par défaut.

                Aucune hauteur minimale, et la mascotte s'efface quand la place
                descend sous la moitié de sa taille. Avec `minHeight`, le
                conteneur ne pouvait plus se réduire, la boîte de défilement
                restait à la hauteur de l'écran et la fin du texte était rognée
                **sans pouvoir défiler** : mesuré sur un iPhone SE à la troisième
                taille d'accessibilité, où « lieu de cœur : six cases, une carte
                de visite culturelle » disparaissait sous le bouton. Un décor
                cède la place à un texte. */}
            <View
              style={{ flex: 1, alignItems: 'center' }}
              onLayout={(e) => setPopyRoom(e.nativeEvent.layout.height)}
            >
              {popyRoom === null || popyRoom >= popySize / 2 ? (
                <Image
                  source={popyContent}
                  style={{
                    position: 'absolute',
                    bottom: -20,
                    width: popySize,
                    height: popySize,
                    transform: [{ rotate: '-3deg' }],
                  }}
                  resizeMode="contain"
                />
              ) : null}
            </View>

            <Text
              allowFontScaling={false}
              style={{
                textAlign: 'center',
                ...scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, 14, 20),
                color: 'rgba(10,10,10,0.75)',
                maxWidth: 280,
                alignSelf: 'center',
                marginBottom: 24,
              }}
            >
              Ton film, ta série, ton artiste, ton lieu de cœur : six cases, une carte de visite culturelle.
            </Text>
          </ScrollView>

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
