import { Pressable, Text, View } from 'react-native';
import type { CategoryKey } from '@/supabase/types';
import { CATEGORY_META } from './categories';
import { GRID_GEOMETRY } from './geometry';

type EmptyTileProps = {
  cat: CategoryKey;
  height: number;
  /** Échelle propagée depuis BentoGrid (cf. Tile.scale). */
  scale?: number;
  rotate?: number;
  /**
   * Consultation : emplacement neutre au lieu de l'invitation à remplir.
   * Cf. le commentaire de `BentoGrid.readOnly`.
   */
  readOnly?: boolean;
  onPress?: () => void;
};

/**
 * Placeholder pour une catégorie non encore remplie.
 *
 * Deux variantes :
 *
 * - **composer** (défaut) : bordure pointillée, plus signe central, label
 *   tout-caps, `Pressable` qui ouvre la recherche ;
 * - **consultation** (`readOnly`) : même bordure pointillée, mais sans le
 *   plus ni l'accent jaune, et sans rôle de bouton. On regarde le bento de
 *   quelqu'un d'autre : rien à y remplir.
 *
 * Cf. design Claude Design — `EmptyTile` dans `bento-tiles.jsx`.
 */
export function EmptyTile({
  cat,
  height,
  scale = 1,
  rotate = 0,
  readOnly = false,
  onPress,
}: EmptyTileProps) {
  const meta = CATEGORY_META[cat];
  const s = Math.max(0.7, scale);
  const circleSize = Math.round(36 * s);
  const plusSize = Math.round(20 * s);
  const labelSize = Math.max(8, Math.round(10 * s));

  const frame = {
    height,
    width: '100%',
    // Tint jaune léger pour bien se détacher du cream de la BentoFrame
    backgroundColor: '#fff4d8',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(10,10,10,0.45)',
    borderRadius: GRID_GEOMETRY.TILE_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6 * s,
    padding: 8,
    transform: [{ rotate: `${rotate}deg` }],
  } as const;

  if (readOnly) {
    return (
      <View
        accessible
        accessibilityLabel={`${meta.label} : case vide`}
        style={{ ...frame, borderColor: 'rgba(10,10,10,0.22)', backgroundColor: '#f6ecd4' }}
      >
        <Text
          style={{
            fontFamily: 'Bungee',
            fontSize: labelSize,
            letterSpacing: 1.2,
            color: 'rgba(10,10,10,0.35)',
            textTransform: 'uppercase',
          }}
        >
          {meta.label}
        </Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Ajouter ${meta.label.toLowerCase()}`}
      accessibilityHint="Ouvre la recherche pour remplir cette case"
      style={frame}
    >
      <View
        style={{
          width: circleSize,
          height: circleSize,
          borderRadius: circleSize / 2,
          backgroundColor: '#fbbf24',
          borderWidth: 2,
          borderColor: '#0a0a0a',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: plusSize, fontWeight: '800', color: '#0a0a0a', lineHeight: plusSize + 2 }}>+</Text>
      </View>
      <Text
        style={{
          fontFamily: 'Bungee',
          fontSize: labelSize,
          letterSpacing: 1.2,
          color: '#0a0a0a',
          textTransform: 'uppercase',
        }}
      >
        {meta.label}
      </Text>
    </Pressable>
  );
}
