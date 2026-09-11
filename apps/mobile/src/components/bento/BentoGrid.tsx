import { View } from 'react-native';
import type { ViewStyle } from 'react-native';
import type { CategoryKey } from '@/supabase/types';
import { EmptyTile } from './EmptyTile';
import { GRID_GEOMETRY } from './geometry';
import { Tile, type TileData } from './Tile';
import { SHADOWS } from '@/components/primitives/shadow';

export type BentoItems = Partial<Record<CategoryKey, TileData>>;

type BentoGridProps = {
  /** Items remplis, keyés par catégorie. Si une catégorie manque → EmptyTile. */
  items: BentoItems;
  /** Échelle (1 = portrait mobile standard, 1.45 pour image de partage, 0.78 pour onboarding). */
  scale?: number;
  /** Si `true`, toutes les cases sont rendues vides (utile pour l'écran Mécanique). */
  empty?: boolean;
  /** Callback quand l'utilisateur tape une case. */
  onTap?: (cat: CategoryKey) => void;
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
};

/**
 * Grille bento à compartiments fixes — métaphore boîte bento :
 *   Row 1 : Film (grand)
 *   Row 2 : Série + Artiste (mid)
 *   Row 3 : Chanson + Créateur + Lieu (small)
 *
 * Container : fond crème + bordure ink épaisse + 4 rivets noirs dans les
 * coins, comme le hero de la landing (`BentoFrame`). Les compartiments
 * restent posés à l'intérieur sans gap noir gênant, et les EmptyTiles sont
 * visibles sur le fond crème.
 */
export function BentoGrid({
  items,
  scale = 1,
  empty = false,
  onTap,
  readOnly = false,
  frameBorderWidth = GRID_GEOMETRY.BORDER,
}: BentoGridProps) {
  const H_FILM = GRID_GEOMETRY.H_FILM * scale;
  const H_MID = GRID_GEOMETRY.H_MID * scale;
  const H_SM = GRID_GEOMETRY.H_SM * scale;
  const GAP = GRID_GEOMETRY.GAP * scale;
  const PAD = GRID_GEOMETRY.PAD * scale;
  const BORDER = Math.max(3, Math.round(frameBorderWidth * scale));
  const RADIUS = GRID_GEOMETRY.RADIUS * scale;

  const renderTile = (cat: CategoryKey, height: number, size: 'sm' | 'md' | 'lg', rotate: number) => {
    const item = items[cat];
    if (empty || !item) {
      return (
        <EmptyTile
          cat={cat}
          height={height}
          scale={scale}
          rotate={rotate * 0.5}
          readOnly={readOnly}
          onPress={onTap ? () => onTap(cat) : undefined}
        />
      );
    }
    return (
      <Tile
        cat={cat}
        data={item}
        height={height}
        size={size}
        scale={scale}
        rotate={rotate}
        onPress={onTap ? () => onTap(cat) : undefined}
      />
    );
  };

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

      {/* Row 1 — Film big */}
      <View>{renderTile('film', H_FILM, 'lg', -0.5)}</View>

      {/* Row 2 — Série + Artiste */}
      <View style={{ flexDirection: 'row', gap: GAP }}>
        <View style={{ flex: 1 }}>{renderTile('series', H_MID, 'md', 0.4)}</View>
        <View style={{ flex: 1 }}>{renderTile('artist', H_MID, 'md', -0.3)}</View>
      </View>

      {/* Row 3 — Chanson + Créateur + Lieu */}
      <View style={{ flexDirection: 'row', gap: GAP }}>
        <View style={{ flex: 1 }}>{renderTile('track', H_SM, 'sm', -0.3)}</View>
        <View style={{ flex: 1 }}>{renderTile('creator', H_SM, 'sm', 0.5)}</View>
        <View style={{ flex: 1 }}>{renderTile('place', H_SM, 'sm', -0.2)}</View>
      </View>
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
