import { Pressable, Text, View } from 'react-native';
import type { CategoryKey } from '@/supabase/types';
import { CATEGORY_META } from './categories';

type EmptyTileProps = {
  cat: CategoryKey;
  height: number;
  rotate?: number;
  onPress?: () => void;
};

/**
 * Placeholder pour une catégorie non encore remplie dans le composer.
 * Bordure pointillée, plus signe central, label tout-caps.
 *
 * Cf. design Claude Design — `EmptyTile` dans `bento-tiles.jsx`.
 */
export function EmptyTile({ cat, height, rotate = 0, onPress }: EmptyTileProps) {
  const meta = CATEGORY_META[cat];
  return (
    <Pressable
      onPress={onPress}
      style={{
        height,
        width: '100%',
        backgroundColor: 'rgba(10,10,10,0.04)',
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: 'rgba(10,10,10,0.28)',
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: 8,
        transform: [{ rotate: `${rotate}deg` }],
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: 'rgba(10,10,10,0.08)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: '700', color: 'rgba(10,10,10,0.55)' }}>+</Text>
      </View>
      <Text
        style={{
          fontFamily: 'Bungee',
          fontSize: 10,
          letterSpacing: 1.2,
          color: 'rgba(10,10,10,0.55)',
          textTransform: 'uppercase',
        }}
      >
        {meta.label}
      </Text>
    </Pressable>
  );
}
