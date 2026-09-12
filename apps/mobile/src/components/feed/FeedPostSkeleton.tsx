import { View } from 'react-native';
import { GRID_GEOMETRY } from '@/components/bento/geometry';
import { SHADOWS } from '@/components/primitives/shadow';
import { HEADER_GAP, POST_GAP } from './layout';

/** Gris posé sur le crème de la boîte : présent sans être sale. */
const BONE = 'rgba(10,10,10,0.09)';

type FeedPostSkeletonProps = {
  sideInset: number;
  scale: number;
};

/**
 * Squelette d'un post, affiché pendant le premier chargement du fil.
 *
 * Un `ActivityIndicator` centré fait sauter la hauteur de l'écran à l'arrivée
 * des données et n'annonce rien de ce qui va s'afficher. Le squelette occupe
 * exactement la place du post à venir.
 *
 * Les proportions viennent de `GRID_GEOMETRY`, la même source que
 * `BentoGrid` : recopier les hauteurs de rangée ici les ferait diverger à la
 * première retouche du design.
 *
 * Volontairement statique, sans pulsation : il n'est visible qu'une fraction
 * de seconde sur un réseau normal, et une animation demanderait un worklet
 * Reanimated pour un gain nul.
 */
export function FeedPostSkeleton({ sideInset, scale }: FeedPostSkeletonProps) {
  const g = GRID_GEOMETRY;
  const s = (value: number) => value * scale;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ marginHorizontal: sideInset, marginBottom: POST_GAP }}
    >
      {/* Étiquette d'identité */}
      <View
        style={{
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: '#ffffff',
          borderWidth: 2.5,
          borderColor: '#0a0a0a',
          borderRadius: 14,
          paddingLeft: 8,
          paddingRight: 16,
          paddingVertical: 8,
          transform: [{ rotate: '-1.5deg' }],
        }}
      >
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: BONE }} />
        <View style={{ gap: 6 }}>
          <View style={{ width: 108, height: 12, borderRadius: 4, backgroundColor: BONE }} />
          <View style={{ width: 68, height: 8, borderRadius: 4, backgroundColor: BONE }} />
        </View>
      </View>

      {/* Boîte */}
      <View
        style={[
          {
            marginTop: HEADER_GAP,
            backgroundColor: '#fbf3de',
            borderRadius: s(g.RADIUS),
            padding: s(g.PAD),
            borderWidth: Math.max(3, Math.round(g.BORDER * scale)),
            borderColor: '#0a0a0a',
            gap: s(g.GAP),
          },
          SHADOWS.stampLg,
        ]}
      >
        <Bone height={s(g.H_FILM)} radius={s(g.TILE_RADIUS)} />
        <View style={{ flexDirection: 'row', gap: s(g.GAP) }}>
          <Bone height={s(g.H_MID)} radius={s(g.TILE_RADIUS)} grow />
          <Bone height={s(g.H_MID)} radius={s(g.TILE_RADIUS)} grow />
        </View>
        <View style={{ flexDirection: 'row', gap: s(g.GAP) }}>
          <Bone height={s(g.H_SM)} radius={s(g.TILE_RADIUS)} grow />
          <Bone height={s(g.H_SM)} radius={s(g.TILE_RADIUS)} grow />
          <Bone height={s(g.H_SM)} radius={s(g.TILE_RADIUS)} grow />
        </View>
      </View>
    </View>
  );
}

/**
 * `grow` uniquement pour les os d'une rangée, jamais pour celui du film.
 *
 * Le conteneur de la boîte est une colonne : un `flex: 1` y distribue la
 * **hauteur** et écrase la hauteur explicite, ce qui aplatissait la rangée du
 * film et faisait gonfler les deux autres. Dans une rangée, l'axe principal
 * est horizontal, donc `flex: 1` répartit la largeur et la hauteur
 * s'applique. C'est exactement ce que fait `BentoGrid`, où le `flex: 1` vit
 * sur les enveloppes de rangée et jamais sur la case du film.
 */
function Bone({
  height,
  radius,
  grow = false,
}: {
  height: number;
  radius: number;
  grow?: boolean;
}) {
  return (
    <View
      style={{
        ...(grow ? { flex: 1 } : { width: '100%' }),
        height,
        borderRadius: radius,
        backgroundColor: BONE,
      }}
    />
  );
}
