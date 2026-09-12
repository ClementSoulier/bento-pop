import { Image, Text, View } from 'react-native';
import { popyForPseudo } from '@/lib/popy-avatar';
import { relativeDate } from '@/lib/relative-date';

const AVATAR = 40;
const RADIUS = 14;
const SHADOW_OFFSET = 4;
const ROTATION = -1.5;

/**
 * Plafond de mise à l'échelle typographique. Sans lui, un appareil réglé sur
 * la plus grande taille de police fait déborder l'étiquette de la largeur de
 * la boîte. 1,4 laisse une amplification confortable sans casser la mise en
 * page.
 */
const MAX_FONT_SCALE = 1.4;

type FeedPostHeaderProps = {
  pseudo: string;
  displayName: string | null;
  publishedAt: string;
  /** Largeur de la boîte, pour empêcher un pseudo long de la dépasser. */
  maxWidth: number;
  /** Horloge injectable, pour des captures et des tests reproductibles. */
  now?: number;
};

/**
 * Étiquette d'identité posée au-dessus de la boîte d'un post.
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
 */
export function FeedPostHeader({
  pseudo,
  displayName,
  publishedAt,
  maxWidth,
  now,
}: FeedPostHeaderProps) {
  const popy = popyForPseudo(pseudo);
  const when = relativeDate(publishedAt, now);
  const meta = [displayName, when].filter(Boolean).join(' · ');

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
              backgroundColor: popy.accent,
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
              source={popy.source}
              style={{ width: AVATAR - 9, height: AVATAR - 9 }}
              resizeMode="contain"
            />
          </View>

          {/* `minWidth: 0` avec `flexShrink` : sans lui, un enfant flex refuse
              de passer sous sa largeur intrinsèque et le `numberOfLines` ne
              tronque jamais. */}
          <View style={{ flexShrink: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={MAX_FONT_SCALE}
              style={{
                fontFamily: 'Extenda',
                fontSize: 16,
                lineHeight: 17,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
              }}
            >
              @{pseudo}
            </Text>
            {meta ? (
              <Text
                numberOfLines={1}
                maxFontSizeMultiplier={MAX_FONT_SCALE}
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
