import { Image } from 'expo-image';
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import popyContent from '@bento-pop/brand/assets/mascot/popy-content.png';
import {
  CONTENT_MAX_FONT_MULTIPLIER,
  CONTROL_MAX_FONT_MULTIPLIER,
  scaledType,
} from '@/components/bento/font-scaling';
import { INK_MUTED, SHADOWS } from '@/components/primitives';
import {
  episodeAccessibilityLabel,
  episodeActionLabel,
  episodeBadgeLabel,
  episodeDurationLabel,
  episodeLabelTitle,
  episodeOpenHint,
  type FeedEpisode,
} from '@/lib/episodes';
import { relativeDate } from '@/lib/relative-date';
import { FeedLabel } from './FeedLabel';
import { HEADER_GAP, POST_GAP } from './layout';

/** Bordure et rayon de la carte d'épisode du site, `border-[4px]` et `rounded-[22px]`. */
const BORDER = 4;
const RADIUS = 22;

/** La police à chasse fixe de la pastille, de la durée et de la dernière ligne, `font-mono` sur le site. */
const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

/** Bento Pop signe ses épisodes du Popy de la marque, sur son jaune. */
const BENTO_POP_AVATAR = { source: popyContent, accent: '#fbbf24' };

type FeedEpisodePostProps = {
  episode: FeedEpisode;
  /** Largeur de la boîte des bentos, cf. `feedBoxWidth` : la carte prend la même. */
  width: number;
  /** Marge de chaque côté, cf. `feedSideInset`. */
  sideInset: number;
  /** Horloge injectable, pour des captures et des tests reproductibles. */
  now?: number;
};

/**
 * Un épisode de l'émission ou du podcast dans « La table ». Chantier 19, D5.
 *
 * L'étiquette d'un bento au-dessus, le Popy de Bento Pop à la place de celui
 * d'un auteur, puis la carte d'épisode du site, à la largeur des boîtes :
 * vignette 16:9, pastille « S2 · E5 », durée, titre sur trois lignes. Ni
 * animateurs ni invités (D7). La date passe dans l'étiquette, comme celle d'un
 * bento, et la dernière ligne dit où mène le tap, qui quitte l'app.
 *
 * Le tap ouvre la plateforme (D3) par `Linking`, qui passe par l'app YouTube
 * ou Spotify quand elle est installée. L'adresse a été vérifiée à la lecture
 * de la route (D8, `isAllowedOpenUrl`).
 *
 * **Accessibilité.** Un seul élément, comme un bento : le libellé dit le type,
 * le numéro, le titre, la durée et la date, l'indication dit où s'ouvre
 * l'épisode. Les descendants sont masqués pour ne pas être lus deux fois.
 */
export function FeedEpisodePost({ episode, width, sideInset, now }: FeedEpisodePostProps) {
  const { fontScale } = useWindowDimensions();
  const thumbnailHeight = Math.round(((width - BORDER * 2) * 9) / 16) + BORDER;
  const duration = episodeDurationLabel(episode.durationSeconds);

  const open = () => {
    // Une adresse https s'ouvre toujours, au pire dans le navigateur : un
    // échec n'a rien à proposer à la place.
    Linking.openURL(episode.openUrl).catch(() => {});
  };

  return (
    <Pressable
      onPress={open}
      accessible
      accessibilityRole="link"
      accessibilityLabel={episodeAccessibilityLabel(episode, now)}
      accessibilityHint={episodeOpenHint(episode.platform)}
      // Style statique, comme `FeedPost` : cf. son commentaire.
      style={{ marginHorizontal: sideInset, marginBottom: POST_GAP }}
    >
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <FeedLabel
          title={episodeLabelTitle(episode.kind)}
          meta={relativeDate(episode.publishedAt, now)}
          avatar={BENTO_POP_AVATAR}
          maxWidth={width}
        />

        <View
          style={[
            {
              marginTop: HEADER_GAP,
              backgroundColor: '#fbf3de',
              borderWidth: BORDER,
              borderColor: '#0a0a0a',
              borderRadius: RADIUS,
            },
            SHADOWS.stamp,
          ]}
        >
          {/* `overflow: hidden` sur la vignette et non sur la carte : posé sur
              la carte, il rognerait son ombre stamp sur iOS. */}
          <View
            style={{
              height: thumbnailHeight,
              borderTopLeftRadius: RADIUS - BORDER,
              borderTopRightRadius: RADIUS - BORDER,
              borderBottomWidth: BORDER,
              borderBottomColor: '#0a0a0a',
              // Les fonds pleins du site, sous un épisode sans vignette.
              backgroundColor: episode.kind === 'show' ? '#0a0a0a' : '#1ed760',
              overflow: 'hidden',
            }}
          >
            {episode.thumbnailUrl ? (
              <Image
                source={{ uri: episode.thumbnailUrl }}
                style={StyleSheet.absoluteFill}
                // Les vignettes YouTube sont en 4:3, bandes noires comprises :
                // recadrées en 16:9, il n'en reste que l'image.
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={160}
                recyclingKey={episode.thumbnailUrl}
              />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text allowFontScaling={false} style={{ fontSize: 64, color: '#fbf3de' }}>
                  {/* U+FE0E : le triangle en texte, et non en émoji. */}
                  {episode.kind === 'show' ? '▶︎' : '🎙'}
                </Text>
              </View>
            )}

            <View
              style={{
                position: 'absolute',
                top: 12,
                left: 12,
                borderRadius: 999,
                borderWidth: 2,
                borderColor: '#0a0a0a',
                backgroundColor: '#fbbf24',
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}
            >
              <Text
                maxFontSizeMultiplier={CONTROL_MAX_FONT_MULTIPLIER}
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  fontWeight: '700',
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                  color: '#0a0a0a',
                  includeFontPadding: false,
                }}
              >
                {episodeBadgeLabel(episode)}
              </Text>
            </View>

            {duration ? (
              <View
                style={{
                  position: 'absolute',
                  bottom: 12,
                  right: 12,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: '#0a0a0a',
                  backgroundColor: '#0a0a0a',
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                }}
              >
                <Text
                  maxFontSizeMultiplier={CONTROL_MAX_FONT_MULTIPLIER}
                  style={{
                    fontFamily: MONO,
                    fontSize: 11,
                    fontWeight: '700',
                    color: '#fbf3de',
                    includeFontPadding: false,
                  }}
                >
                  {duration}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={{ padding: 16, gap: 12 }}>
            <Text
              numberOfLines={3}
              // La police système appliquée à la main : sur Android, React
              // Native ne plafonne pas `lineHeight`, cf. `fontScaleFor`.
              allowFontScaling={false}
              style={{
                fontFamily: 'Fredoka-Bold',
                // 22 et non les 1,15 em du site : sous la hauteur naturelle de
                // Fredoka, 1,21 em, iOS rognerait les accents des capitales.
                ...scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, 18, 22),
                letterSpacing: 0.36,
                textTransform: 'uppercase',
                color: '#0a0a0a',
              }}
            >
              {episode.title}
            </Text>
            <Text
              numberOfLines={1}
              allowFontScaling={false}
              style={{
                fontFamily: MONO,
                ...scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, 10, 14),
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                color: INK_MUTED,
              }}
            >
              {`${episodeActionLabel(episode)} ↗`}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
