import { Pressable, Text, View } from 'react-native';
import type { CategoryKey } from '@/supabase/types';
import { CATEGORY_META } from './categories';

type EmptyTileProps = {
  cat: CategoryKey;
  height: number;
  /** Échelle propagée depuis BentoGrid (cf. Tile.scale). */
  scale?: number;
  rotate?: number;
  onPress?: () => void;
};

/**
 * Placeholder pour une catégorie non encore remplie dans le composer.
 * Bordure pointillée, plus signe central, label tout-caps.
 *
 * Cf. design Claude Design — `EmptyTile` dans `bento-tiles.jsx`.
 */
export function EmptyTile({ cat, height, scale = 1, rotate = 0, onPress }: EmptyTileProps) {
  const meta = CATEGORY_META[cat];
  const s = Math.max(0.7, scale);
  const circleSize = Math.round(36 * s);
  const plusSize = Math.round(20 * s);
  const labelSize = Math.max(8, Math.round(10 * s));
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Ajouter ${meta.label.toLowerCase()}`}
      accessibilityHint="Ouvre la recherche pour remplir cette case"
      style={{
        height,
        width: '100%',
        // Tint jaune léger pour bien se détacher du cream de la BentoFrame
        backgroundColor: '#fff4d8',
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: 'rgba(10,10,10,0.45)',
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6 * s,
        padding: 8,
        transform: [{ rotate: `${rotate}deg` }],
      }}
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
