import { View } from 'react-native';
import type { ViewStyle } from 'react-native';
import type { CategoryKey } from '@/supabase/types';
import { EmptyTile } from './EmptyTile';
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
export function BentoGrid({ items, scale = 1, empty = false, onTap }: BentoGridProps) {
  const H_FILM = 220 * scale;
  const H_MID = 134 * scale;
  const H_SM = 100 * scale;
  const GAP = 10 * scale;
  const PAD = 14 * scale;
  const BORDER = Math.max(3, Math.round(5 * scale));
  const RADIUS = 28 * scale;

  const renderTile = (cat: CategoryKey, height: number, size: 'sm' | 'md' | 'lg', rotate: number) => {
    const item = items[cat];
    if (empty || !item) {
      return (
        <EmptyTile
          cat={cat}
          height={height}
          scale={scale}
          rotate={rotate * 0.5}
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
