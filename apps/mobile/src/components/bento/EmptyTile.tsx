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
        // Tint jaune léger pour bien se détacher du cream de la BentoFrame
        backgroundColor: '#fff4d8',
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: 'rgba(10,10,10,0.45)',
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
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: '#fbbf24',
          borderWidth: 2,
          borderColor: '#0a0a0a',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 20, fontWeight: '800', color: '#0a0a0a', lineHeight: 22 }}>+</Text>
      </View>
      <Text
        style={{
          fontFamily: 'Bungee',
          fontSize: 10,
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
