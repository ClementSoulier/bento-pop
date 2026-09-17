import { View } from 'react-native';
import { boxPlacements } from '@bento-pop/supabase-mobile/bento';
import { SHADOWS } from '@/components/primitives/shadow';
import { GRID_GEOMETRY, gridBorderWidth } from './geometry';

/** Gris posé sur le crème de la boîte : présent sans être sale. */
export const SKELETON_BONE = 'rgba(10,10,10,0.09)';

type BentoBoxSkeletonProps = {
  /** Échelle de la boîte à venir, la même que celle passée à `BentoGrid`. */
  scale: number;
  /**
   * Nombre de cases de la boîte à venir, qui décide de la disposition.
   * Six par défaut, le bento principal : c'est ce que le fil et la page
   * publique attendent tant qu'ils n'ont pas lu leur bento.
   */
  caseCount?: number;
};

/**
 * Squelette d'une boîte bento, aux dimensions exactes de `BentoGrid`.
 *
 * Extrait de `FeedPostSkeleton` pour servir aussi la page publique : une seule
 * source de proportions, comme pour `GRID_GEOMETRY`. Les hauteurs de rangée,
 * les écarts et l'arrondi du cadre viennent des mêmes constantes et de la même
 * fonction que la grille ; recopiés, ils divergeraient à la première retouche
 * du design, et l'arrivée des données ferait sauter la page.
 *
 * Volontairement statique, sans pulsation : il n'est visible qu'une fraction
 * de seconde sur un réseau normal, et une animation demanderait un worklet
 * Reanimated pour un gain nul.
 */
export function BentoBoxSkeleton({ scale, caseCount = 6 }: BentoBoxSkeletonProps) {
  const g = GRID_GEOMETRY;
  const s = (value: number) => value * scale;

  // Les positions regroupées par rangée, depuis la même table que la grille.
  const rangees: { height: number; cases: number }[] = [];
  for (const place of boxPlacements(caseCount)) {
    const rang = place.row - 1;
    rangees[rang] = { height: place.height, cases: (rangees[rang]?.cases ?? 0) + 1 };
  }

  return (
    <View
      style={[
        {
          backgroundColor: '#fbf3de',
          borderRadius: s(g.RADIUS),
          padding: s(g.PAD),
          borderWidth: gridBorderWidth(scale),
          borderColor: '#0a0a0a',
          gap: s(g.GAP),
        },
        SHADOWS.stampLg,
      ]}
    >
      {rangees.map((rangee, rang) =>
        rangee.cases === 1 ? (
          <Bone key={rang} height={s(rangee.height)} radius={s(g.TILE_RADIUS)} />
        ) : (
          <View key={rang} style={{ flexDirection: 'row', gap: s(g.GAP) }}>
            {Array.from({ length: rangee.cases }, (_, i) => (
              <Bone key={i} height={s(rangee.height)} radius={s(g.TILE_RADIUS)} grow />
            ))}
          </View>
        ),
      )}
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
        backgroundColor: SKELETON_BONE,
      }}
    />
  );
}
