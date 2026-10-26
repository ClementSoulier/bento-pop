import { Pressable, View } from 'react-native';
import { BentoGrid } from '@/components/bento';
import { GRID_GEOMETRY } from '@/components/bento/geometry';
import { Sticker } from '@/components/primitives';
import { ActionBar } from '@/components/social/ActionBar';
import {
  accountBentoTitle,
  feedAccessibilityLabel,
  type FeedBento,
  type FeedLabelFor,
} from '@/lib/feed';
import { popyFor } from '@/lib/popy-avatar';
import { relativeDate } from '@/lib/relative-date';
import { FeedLabel } from './FeedLabel';
import { FeedPostHeader } from './FeedPostHeader';
// Les étiquettes vivent dans un module sans dépendance à `react-native`,
// pour que la règle de priorité entre elles reste testable.
import { ribbonFor } from './ribbon';
import { HEADER_GAP, POST_GAP, RIBBON_OFFSET } from './layout';
import { composerCases } from '@/components/bento/cases';

/** Cadre épaissi des posts à étiquette, second signal après l'étiquette. */
const RIBBON_BORDER = 7;

type FeedPostProps = {
  bento: FeedBento;
  /**
   * Largeur de la boîte, cf. `feedBoxWidth`. Sert au cadrage de l'étiquette,
   * et aux titres des cases, cf. `BentoGrid.width`.
   */
  width: number;
  /** Marge de chaque côté, cf. `feedSideInset`. */
  sideInset: number;
  /** Échelle de la grille, cf. `feedScale`. */
  scale: number;
  onPress: () => void;
  /** L'auteur, dans le fil ; le bento, dans la liste d'un compte. */
  labelFor?: FeedLabelFor;
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
 *
 * **Le cœur et la bulle vivent sous le post, à côté de lui** (chantier 22) :
 * dedans, ils seraient masqués avec le reste.
 */
export function FeedPost({
  bento,
  width,
  sideInset,
  scale,
  onPress,
  labelFor = 'author',
  now,
}: FeedPostProps) {
  const ribbon = ribbonFor(bento, { edition: labelFor === 'author' });

  return (
    // Marges et non `width` + `alignSelf` : cf. `feedSideInset`. Portées par
    // le conteneur depuis le chantier 22, qui pose la barre sous le post.
    <View style={{ marginHorizontal: sideInset, marginBottom: POST_GAP }}>
      <Pressable
        onPress={onPress}
        accessible
        accessibilityRole="button"
        accessibilityLabel={feedAccessibilityLabel(bento, now, labelFor)}
        // Le léger assombrissement à l'appui est repris par `android_ripple`
        // sur Android et par l'opacité par défaut du `Pressable` sur iOS.
      >
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {labelFor === 'bento' ? (
            <FeedLabel
              title={accountBentoTitle(bento)}
              meta={relativeDate(bento.publishedAt, now)}
              avatar={popyFor(bento.pseudo, bento.avatar)}
              maxWidth={width}
            />
          ) : (
            <FeedPostHeader
              pseudo={bento.pseudo}
              avatar={bento.avatar}
              displayName={bento.displayName}
              publishedAt={bento.publishedAt}
              maxWidth={width}
              now={now}
            />
          )}

          <View style={{ marginTop: HEADER_GAP }}>
            <BentoGrid
              cases={composerCases(bento.cases, bento.slots)}
              scale={scale}
              width={width}
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
      <ActionBar bentoId={bento.bentoId} ownerId={bento.userId} />
    </View>
  );
}
