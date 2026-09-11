import { Pressable, View } from 'react-native';
import { BentoGrid } from '@/components/bento';
import { GRID_GEOMETRY } from '@/components/bento/geometry';
import { Sticker } from '@/components/primitives';
import { feedAccessibilityLabel, type FeedBento } from '@/lib/feed';
import { FeedPostHeader } from './FeedPostHeader';
import { HEADER_GAP, POST_GAP, RIBBON_OFFSET } from './layout';

/**
 * Étiquette posée sur le coin de la boîte.
 *
 * Prop plutôt que booléen `isFeatured` : le bento de la semaine et les futurs
 * types reprendront le même emplacement avec un autre libellé et une autre
 * couleur (cf. chantier 13). Un nouveau type sera une valeur, pas une
 * branche de plus dans le composant.
 */
export type FeedRibbon = {
  label: string;
  color: string;
  textColor?: string;
};

export const FEATURED_RIBBON: FeedRibbon = {
  label: 'Coup de cœur',
  color: '#e63946',
  textColor: '#fbf3de',
};

/** Cadre épaissi des posts à étiquette, second signal après l'étiquette. */
const RIBBON_BORDER = 7;

type FeedPostProps = {
  bento: FeedBento;
  /** Largeur de la boîte, cf. `feedBoxWidth`. Sert au cadrage de l'étiquette. */
  width: number;
  /** Marge de chaque côté, cf. `feedSideInset`. */
  sideInset: number;
  /** Échelle de la grille, cf. `feedScale`. */
  scale: number;
  onPress: () => void;
  /** Horloge injectable, pour des captures et des tests reproductibles. */
  now?: number;
};

/**
 * Un post du fil : l'étiquette d'identité, puis la boîte bento entière.
 *
 * **Pas de carte autour de la boîte.** La grille est déjà un objet clos et
 * signé, fond crème, bordure épaisse, rivets, ombre stamp. L'emballer
 * donnerait deux cadres concentriques. La boîte *est* le post, l'étiquette
 * flotte au-dessus sur le fond jaune.
 *
 * **Accessibilité.** Le post est un seul élément : le laisser ouvert ferait
 * parcourir une soixantaine de vues par bento, le rendre opaque sans libellé
 * viderait le fil de son contenu pour un utilisateur non voyant. Le libellé
 * énumère la composition, donc un balayage donne tout, sur un élément
 * activable. Les descendants sont masqués pour ne pas être parcourus deux
 * fois.
 */
export function FeedPost({ bento, width, sideInset, scale, onPress, now }: FeedPostProps) {
  const ribbon = bento.isFeatured ? FEATURED_RIBBON : null;

  return (
    <Pressable
      onPress={onPress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={feedAccessibilityLabel(bento, now)}
      // Style statique et non fonction de `pressed` : la variante fonction
      // n'appliquait pas les marges au premier rendu sur iOS. Le léger
      // assombrissement à l'appui est repris par `android_ripple` sur Android
      // et par l'opacité par défaut du `Pressable` sur iOS.
      style={{
        // Marges et non `width` + `alignSelf` : cf. `feedSideInset`.
        marginHorizontal: sideInset,
        marginBottom: POST_GAP,
      }}
    >
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <FeedPostHeader
          pseudo={bento.pseudo}
          displayName={bento.displayName}
          publishedAt={bento.publishedAt}
          maxWidth={width}
          now={now}
        />

        <View style={{ marginTop: HEADER_GAP }}>
          <BentoGrid
            items={bento.slots}
            scale={scale}
            readOnly
            frameBorderWidth={ribbon ? RIBBON_BORDER : GRID_GEOMETRY.BORDER}
          />

          {/* Rendue APRÈS la boîte : elle passe donc au-dessus sur les deux
              plateformes sans avoir à toucher au `zIndex`, qui demanderait une
              `elevation` sur Android. */}
          {ribbon ? (
            <Sticker
              color={ribbon.color}
              textColor={ribbon.textColor ?? '#ffffff'}
              rotation={-8}
              size={11}
              style={{ position: 'absolute', top: RIBBON_OFFSET.top, right: RIBBON_OFFSET.right }}
            >
              {ribbon.label}
            </Sticker>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
