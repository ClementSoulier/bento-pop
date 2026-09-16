import { PixelRatio, Platform, Text, View, useWindowDimensions } from 'react-native';
import {
  CONTENT_MAX_FONT_MULTIPLIER,
  CONTROL_MAX_FONT_MULTIPLIER,
  TITLE_MAX_FONT_MULTIPLIER,
  scaledType,
} from '@/components/bento/font-scaling';
import { displayTitleScale, extendaAccentRoom } from '@/lib/display-title';
import { INK_MUTED } from './ink';

type PageTitleProps = {
  /** Petit label tout-caps au-dessus du titre. */
  kicker?: string;
  title: string;
  /** Sous-titre / lead optionnel sous le titre. */
  sub?: string;
};

const SIDE_PADDING = 20;
const TITLE_LETTER_SPACING = -0.3;

/**
 * En-tête de section : kicker (eyebrow) + titre display + sub.
 * Cf. design Claude Design — `PageTitle` dans `screens.jsx`.
 *
 * Le titre ne coupe jamais un mot et ne grossit que jusqu'au plafond des titres :
 * à la plus grande police, l'accueil lisait « LES / RÈGLE / S », et son bouton
 * sortait de l'écran. Il réserve aussi la place des accents de sa première
 * ligne, que l'interligne serré rognait dès la taille par défaut : « LES
 * REGLES ». Cf. `lib/display-title.ts`.
 */
export function PageTitle({ kicker, title, sub }: PageTitleProps) {
  const { fontScale, width } = useWindowDimensions();
  const capped = scaledType(fontScale, TITLE_MAX_FONT_MULTIPLIER, 30, 28);
  const shrink = displayTitleScale(
    title,
    width - SIDE_PADDING * 2,
    capped.fontSize,
    TITLE_LETTER_SPACING,
    Platform.OS === 'android' ? PixelRatio.get() : undefined,
  );
  const titleType = { fontSize: capped.fontSize * shrink, lineHeight: capped.lineHeight * shrink };
  const accentRoom = extendaAccentRoom(title, titleType.fontSize);
  return (
    <View style={{ paddingHorizontal: SIDE_PADDING, paddingBottom: 4 }}>
      {kicker ? (
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          maxFontSizeMultiplier={CONTROL_MAX_FONT_MULTIPLIER}
          style={{
            fontFamily: 'Bungee',
            fontSize: 11,
            letterSpacing: 2,
            color: INK_MUTED,
            marginBottom: 6,
            textTransform: 'uppercase',
          }}
        >
          {kicker}
        </Text>
      ) : null}
      <Text
        accessibilityRole="header"
        allowFontScaling={false}
        // Android : passer à la ligne entre deux mots, jamais au milieu.
        textBreakStrategy="simple"
        style={{
          fontFamily: 'Extenda',
          ...titleType,
          letterSpacing: TITLE_LETTER_SPACING,
          color: '#0a0a0a',
          textTransform: 'uppercase',
          paddingTop: accentRoom,
          marginTop: -accentRoom,
        }}
      >
        {title}
      </Text>
      {sub ? (
        <Text
          allowFontScaling={false}
          style={{
            marginTop: 6,
            ...scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, 13, 18),
            color: 'rgba(10,10,10,0.7)',
          }}
        >
          {sub}
        </Text>
      ) : null}
    </View>
  );
}
