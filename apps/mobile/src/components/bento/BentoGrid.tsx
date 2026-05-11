import { View } from 'react-native';
import type { CategoryKey } from '@/supabase/types';
import { EmptyTile } from './EmptyTile';
import { Tile, type TileData } from './Tile';

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
 * Cf. design Claude Design — `BentoGrid` dans `bento-tiles.jsx`.
 *
 * Largeur dictée par le parent (le composant prend `width: 100%`), seules
 * les hauteurs varient avec `scale`.
 */
export function BentoGrid({ items, scale = 1, empty = false, onTap }: BentoGridProps) {
  const H_FILM = 220 * scale;
  const H_MID = 134 * scale;
  const H_SM = 100 * scale;
  const GAP = 8 * scale;

  const renderTile = (cat: CategoryKey, height: number, size: 'sm' | 'md' | 'lg', rotate: number) => {
    const item = items[cat];
    if (empty || !item) {
      return (
        <EmptyTile
          cat={cat}
          height={height}
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
        rotate={rotate}
        onPress={onTap ? () => onTap(cat) : undefined}
      />
    );
  };

  return (
    <View
      style={{
        backgroundColor: '#0a0a0a',
        borderRadius: 24,
        padding: GAP * 1.5,
        borderWidth: 2.5 * scale,
        borderColor: '#0a0a0a',
        gap: GAP,
      }}
    >
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
