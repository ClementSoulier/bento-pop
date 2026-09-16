import { View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { boxPlacements } from '@bento-pop/supabase-mobile/bento';
import { EmptyTile } from './EmptyTile';
import { GRID_GEOMETRY, gridBorderWidth, gridTileWidth } from './geometry';
import type { BentoCase } from './cases';
import { Tile } from './Tile';
import { TilePulse } from './TilePulse';
import { SHADOWS } from '@/components/primitives/shadow';

type BentoGridProps = {
  /**
   * Les cases, dans l'ordre de lecture. Leur nombre décide de la disposition
   * (`BOX_LAYOUTS`) ; une case sans `tile` se rend vide.
   */
  cases: readonly BentoCase[];
  /** Échelle (1 = portrait mobile standard, 1.45 pour image de partage, 0.78 pour onboarding). */
  scale?: number;
  /** Si `true`, toutes les cases sont rendues vides (utile pour l'écran Mécanique). */
  empty?: boolean;
  /** Callback quand l'utilisateur tape une case, avec sa clé. */
  onTap?: (caseKey: string) => void;
  /**
   * Grille de consultation : les cases vides deviennent de simples
   * emplacements neutres au lieu du « + Ajoute ton film » du composer.
   *
   * Sans ça, le bento d'autrui invite à remplir une case qui n'est pas la
   * sienne, sur un bouton qui ne fait rien. Le cas n'apparaît que si un item
   * est masqué par la RLS (item en attente de modération), mais le fil, qui
   * affiche des bentos entiers, le rend visible pour de bon.
   */
  readOnly?: boolean;
  /**
   * Épaisseur du cadre, avant mise à l'échelle. Le fil monte à 7 pour
   * distinguer un coup de cœur sans changer de composant.
   */
  frameBorderWidth?: number;
  /**
   * Case à faire pulser, et jeton qui rejoue l'animation à chaque pose.
   * `null` partout ailleurs que sur le composer : le fil, la page publique
   * et l'image de partage rendent des bentos figés.
   */
  pulse?: { caseKey: string; seq: number } | null;
  /**
   * `false` pour une grille qui ne suit pas la police système : l'image de
   * partage, qui doit sortir identique pour tout le monde. Partout ailleurs,
   * les cases grossissent jusqu'à leur plafond, cf. `font-scaling.ts`.
   */
  allowFontScaling?: boolean;
  /**
   * Largeur de la boîte, cadre compris, telle que l'écran la pose. Un titre y
   * mesure son premier mot, cf. `tileTitleScale` ; sans elle, il se couperait
   * au milieu. Ce n'est pas toujours `GRID_WIDTH × scale`, cf. `gridTileWidth`.
   * Seule une grille vide, comme celle de l'écran de mécanique, s'en passe.
   */
  width?: number;
};

/**
 * La boîte bento, de 2 à 6 cases.
 *
 * Cadre crème, contour encre épais et quatre rivets dans les coins, comme le
 * hero de la landing (`BentoFrame`). Les compartiments restent posés à
 * l'intérieur sans écart noir, et les cases vides se voient sur le crème.
 *
 * **La disposition ne vit plus ici.** Elle était écrite à la main, six appels
 * en face de six autres dans `layout.ts` côté web : c'est ce doublon qui a
 * laissé l'aperçu de lien diverger pendant des mois. Rangées, hauteurs,
 * gabarits et rotations viennent désormais de `boxPlacements(n)`, la table
 * partagée, et le nombre de cases suffit à décider du dessin.
 *
 * Une case vide applique la moitié de la rotation de sa tuile, comme avant.
 */
export function BentoGrid({
  cases,
  scale = 1,
  empty = false,
  onTap,
  readOnly = false,
  frameBorderWidth = GRID_GEOMETRY.BORDER,
  pulse = null,
  allowFontScaling = true,
  width,
}: BentoGridProps) {
  const GAP = GRID_GEOMETRY.GAP * scale;
  const PAD = GRID_GEOMETRY.PAD * scale;
  // La même fonction que le modèle de la page publique et que le squelette :
  // recopié, l'arrondi du cadre dériverait d'un point entre les trois.
  const BORDER = gridBorderWidth(scale, frameBorderWidth);
  const RADIUS = GRID_GEOMETRY.RADIUS * scale;

  const places = boxPlacements(cases.length);

  const renderTile = (index: number) => {
    const place = places[index];
    const item = cases[index];
    if (!place || !item) return null;

    const height = place.height * scale;
    if (empty || !item.tile) {
      return (
        <EmptyTile
          prompt={item.prompt}
          height={height}
          scale={scale}
          rotate={place.rotate * 0.5}
          readOnly={readOnly}
          onPress={onTap ? () => onTap(item.key) : undefined}
          allowFontScaling={allowFontScaling}
        />
      );
    }
    return (
      <TilePulse trigger={pulse?.caseKey === item.key ? pulse.seq : null}>
        <Tile
          stamp={item.stamp}
          prompt={item.prompt}
          data={item.tile}
          height={height}
          width={
            width === undefined
              ? undefined
              : gridTileWidth(width, scale, place.casesInRow, frameBorderWidth)
          }
          size={place.size}
          scale={scale}
          rotate={place.rotate}
          onPress={onTap ? () => onTap(item.key) : undefined}
          allowFontScaling={allowFontScaling}
        />
      </TilePulse>
    );
  };

  // Les positions regroupées par rangée, dans l'ordre.
  const rangees: number[][] = [];
  for (const place of places) {
    const rang = place.row - 1;
    (rangees[rang] ??= []).push(place.index);
  }

  return (
    <View
      style={[
        {
          backgroundColor: '#fbf3de',
          borderRadius: RADIUS,
          padding: PAD,
          borderWidth: BORDER,
          borderColor: '#0a0a0a',
          gap: GAP,
          position: 'relative',
        },
        SHADOWS.stampLg,
      ]}
    >
      {/* Rivets noirs dans les coins, style « baguettes » de la BentoFrame landing */}
      <Rivet position="tl" />
      <Rivet position="tr" />
      <Rivet position="bl" />
      <Rivet position="br" />

      {rangees.map((indices, rang) =>
        // Une rangée d'une seule case garde un `View` nu, sans `flexDirection`
        // ni `flex: 1` : c'est ce que le JSX faisait pour le film, et un
        // conteneur en rangée y changerait la mesure d'un demi-point.
        indices.length === 1 ? (
          <View key={rang}>{renderTile(indices[0]!)}</View>
        ) : (
          <View key={rang} style={{ flexDirection: 'row', gap: GAP }}>
            {indices.map((i) => (
              <View key={i} style={{ flex: 1 }}>
                {renderTile(i)}
              </View>
            ))}
          </View>
        ),
      )}
    </View>
  );
}

/** Rivet noir façon « baguette » dans un coin de la frame. */
function Rivet({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const SIZE = 8;
  const OFFSET = 8;
  const style: ViewStyle = {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: '#0a0a0a',
  };
  if (position === 'tl') { style.top = OFFSET; style.left = OFFSET; }
  if (position === 'tr') { style.top = OFFSET; style.right = OFFSET; }
  if (position === 'bl') { style.bottom = OFFSET; style.left = OFFSET; }
  if (position === 'br') { style.bottom = OFFSET; style.right = OFFSET; }
  return <View pointerEvents="none" style={style} />;
}
