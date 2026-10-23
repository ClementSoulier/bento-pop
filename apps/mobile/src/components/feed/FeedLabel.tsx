import { Image, PixelRatio, Platform, Text, View, useWindowDimensions } from 'react-native';
import { CONTENT_MAX_FONT_MULTIPLIER, fontScaleFor } from '@/components/bento/font-scaling';
import { extendaAccentRoom } from '@/lib/display-title';

const AVATAR = 40;
const RADIUS = 14;
const SHADOW_OFFSET = 4;
const ROTATION = -1.5;
const TITLE_SIZE = 16;

type FeedLabelProps = {
  /** La première ligne, en Extenda : `@pseudo`, ou « Bento Pop · Émission ». */
  title: string;
  /** La seconde, plus discrète : nom affiché, date relative. Vide, elle disparaît. */
  meta: string;
  /** Le Popy de l'avatar, et la couleur du rond derrière lui. */
  avatar: { source: number; accent: string };
  /** Largeur de la boîte, pour empêcher un titre long de la dépasser. */
  maxWidth: number;
  /**
   * Lignes du titre, une par défaut : un pseudo trop long se coupe. Deux pour
   * un épisode, dont le type se perdrait sinon aux grandes tailles de police,
   * « BENTO POP · ÉMIS… », relevé à la recette du chantier 19.
   */
  titleLines?: number;
};

/**
 * Étiquette posée au-dessus d'un post du fil : celle d'un bento, avec le Popy
 * et le pseudo de son auteur, ou celle d'un épisode de Bento Pop (chantier 19).
 *
 * Elle ne chevauche volontairement pas la boîte. Superposer deux frères sur
 * Android demande une `elevation`, or les ombres du produit sont dessinées à
 * la main précisément parce que les ombres natives se décalent sous `rotate`
 * sur iOS. La rotation, la bordure et l'ombre plate suffisent à l'effet
 * « collé à la main », sans piège de plateforme.
 *
 * L'ombre est une vue clonée derrière la boîte, et non un `shadow*` natif :
 * même raison que dans `Sticker`, dont ce composant reprend le vocabulaire.
 * Combinée à `transform: rotate(...)`, l'ombre native iOS bave sur la droite.
 *
 * Le titre réserve la place de ses accents : Extenda les dessine au-dessus de
 * son ascendante, et le « É » d'« ÉMISSION » serait rogné. Un pseudo n'en a
 * jamais, et la réserve est alors nulle.
 */
export function FeedLabel({ title, meta, avatar, maxWidth, titleLines = 1 }: FeedLabelProps) {
  const { fontScale } = useWindowDimensions();
  const accentRoom = extendaAccentRoom(
    title,
    TITLE_SIZE * fontScaleFor(fontScale, CONTENT_MAX_FONT_MULTIPLIER),
    Platform.OS === 'android' ? PixelRatio.get() : undefined,
  );

  return (
    <View style={{ alignSelf: 'flex-start', maxWidth, transform: [{ rotate: `${ROTATION}deg` }] }}>
      <View>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: SHADOW_OFFSET,
            bottom: -SHADOW_OFFSET,
            left: 0,
            right: 0,
            backgroundColor: '#0a0a0a',
            borderRadius: RADIUS,
          }}
        />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: '#ffffff',
            borderWidth: 2.5,
            borderColor: '#0a0a0a',
            borderRadius: RADIUS,
            paddingLeft: 8,
            paddingRight: 16,
            paddingVertical: 8,
          }}
        >
          <View
            style={{
              width: AVATAR,
              height: AVATAR,
              borderRadius: AVATAR / 2,
              backgroundColor: avatar.accent,
              borderWidth: 2.5,
              borderColor: '#0a0a0a',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {/* Le Popy est plus petit que le masque rond : à taille égale, le
                cercle lui rogne les oreilles. */}
            <Image
              source={avatar.source}
              style={{ width: AVATAR - 9, height: AVATAR - 9 }}
              resizeMode="contain"
            />
          </View>

          {/* `minWidth: 0` avec `flexShrink` : sans lui, un enfant flex refuse
              de passer sous sa largeur intrinsèque et le `numberOfLines` ne
              tronque jamais. */}
          <View style={{ flexShrink: 1, minWidth: 0 }}>
            <Text
              numberOfLines={titleLines}
              maxFontSizeMultiplier={CONTENT_MAX_FONT_MULTIPLIER}
              style={{
                fontFamily: 'Extenda',
                fontSize: TITLE_SIZE,
                lineHeight: 17,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                paddingTop: accentRoom,
                marginTop: -accentRoom,
              }}
            >
              {title}
            </Text>
            {meta ? (
              <Text
                numberOfLines={1}
                maxFontSizeMultiplier={CONTENT_MAX_FONT_MULTIPLIER}
                style={{ marginTop: 3, fontSize: 11, color: 'rgba(10,10,10,0.6)' }}
              >
                {meta}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}
