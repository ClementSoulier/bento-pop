import { Image, Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { CategoryKey } from '@/supabase/types';
import { CATEGORY_META } from './categories';
import { PALETTES, type PaletteKey } from './palettes';
import { SHADOWS } from '@/components/primitives/shadow';

export type TileSize = 'sm' | 'md' | 'lg';

export type TileData = {
  title: string;
  subtitle?: string;
  /** URL d'une vraie image (poster TMDb, cover MusicBrainz…). */
  imageUrl?: string;
  /** Palette de fallback / overlay décoratif. */
  paletteKey?: PaletteKey;
};

type TileProps = {
  cat: CategoryKey;
  data: TileData;
  height: number;
  size?: TileSize;
  rotate?: number;
  onPress?: () => void;
};

const SIZE_CONF: Record<TileSize, { title: number; sub: number; pad: number; stamp: number }> = {
  lg: { title: 28, sub: 13, pad: 16, stamp: 9 },
  md: { title: 17, sub: 11, pad: 12, stamp: 9 },
  sm: { title: 13, sub: 9.5, pad: 9, stamp: 8 },
};

/**
 * Tile remplie d'un compartiment bento.
 *
 * Rendu : image en background (si `imageUrl`) + overlay gradient sombre
 * (pour la lisibilité du titre) + stamp catégorie en haut-gauche + titre +
 * sous-titre en bas. Si pas d'image, la palette occupe tout le fond.
 *
 * Cf. design Claude Design — `Tile` dans `bento-tiles.jsx`.
 */
export function Tile({ cat, data, height, size = 'md', rotate = 0, onPress }: TileProps) {
  const meta = CATEGORY_META[cat];
  const palette = PALETTES[data.paletteKey ?? 'neutral'];
  const conf = SIZE_CONF[size];
  const hasImage = Boolean(data.imageUrl);

  const inner = (
    <View
      style={{
        flex: 1,
        borderRadius: 18,
        overflow: 'hidden',
        backgroundColor: palette.colors[0],
        justifyContent: 'flex-end',
        padding: conf.pad,
      }}
    >
      {/* Background : image en plein cadre OU dégradé palette */}
      {hasImage ? (
        <Image
          source={{ uri: data.imageUrl }}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      ) : (
        <LinearGradient
          colors={palette.colors}
          start={palette.start}
          end={palette.end}
          style={{ position: 'absolute', inset: 0 }}
        />
      )}

      {/* Overlay gradient sombre du bas (lisibilité texte sur image) */}
      {hasImage ? (
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)']}
          start={{ x: 0.5, y: 0.3 }}
          end={{ x: 0.5, y: 1 }}
          style={{ position: 'absolute', inset: 0 }}
        />
      ) : null}

      {/* Stamp catégorie haut-gauche */}
      <View
        style={{
          position: 'absolute',
          top: conf.pad,
          left: conf.pad,
          backgroundColor: hasImage ? '#0a0a0a' : palette.ink,
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 4,
        }}
      >
        <Text
          style={{
            color: hasImage ? '#ffffff' : palette.colors[0],
            fontFamily: 'Bungee',
            fontSize: conf.stamp,
            letterSpacing: 1,
          }}
        >
          {meta.stamp}
        </Text>
      </View>

      {/* Titre + subtitle */}
      <View>
        <Text
          numberOfLines={2}
          style={{
            color: hasImage ? '#ffffff' : palette.ink,
            fontFamily: 'Extenda',
            fontSize: conf.title,
            lineHeight: conf.title * 0.95,
            letterSpacing: -0.3,
            textTransform: 'uppercase',
            textShadowColor: hasImage || palette.ink === '#ffffff' ? 'rgba(0,0,0,0.4)' : 'transparent',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 0,
          }}
        >
          {data.title}
        </Text>
        {data.subtitle ? (
          <Text
            numberOfLines={1}
            style={{
              marginTop: 4,
              color: hasImage ? 'rgba(255,255,255,0.85)' : palette.ink,
              fontSize: conf.sub,
              fontWeight: '500',
              letterSpacing: 0.3,
              opacity: hasImage ? 1 : 0.85,
            }}
          >
            {data.subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );

  const wrapStyle = [
    { height, width: '100%' as const, transform: [{ rotate: `${rotate}deg` }] },
    SHADOWS.stamp,
    { borderWidth: 2.5, borderColor: '#0a0a0a', borderRadius: 18 },
  ];

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={wrapStyle}>
        {inner}
      </Pressable>
    );
  }
  return <View style={wrapStyle}>{inner}</View>;
}
