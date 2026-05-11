import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ViewStyle } from 'react-native';
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

/**
 * Config par taille. `letterSpacing` positif pour aérer la police Extenda
 * Yotta dont le crénage natif est très serré ; sans ça les lettres se
 * touchent (« SEVERANCE », « ORELSAN » illisibles).
 */
const SIZE_CONF: Record<TileSize, {
  title: number;
  sub: number;
  pad: number;
  stamp: number;
  letterSpacing: number;
}> = {
  lg: { title: 28, sub: 13, pad: 16, stamp: 9, letterSpacing: 1.2 },
  md: { title: 17, sub: 11, pad: 12, stamp: 9, letterSpacing: 0.8 },
  sm: { title: 13, sub: 9.5, pad: 9, stamp: 8, letterSpacing: 0.5 },
};

const RADIUS = 18;
const BORDER = 2.5;

/**
 * Tile remplie d'un compartiment bento.
 *
 * Une seule View racine avec border + radius + overflow:hidden — tout le
 * contenu (image, gradient, stamps, texte) est clipped proprement à
 * l'intérieur des coins arrondis. Pas de double View imbriqué qui causait
 * le débordement visible de l'image dans les angles.
 *
 * Cf. design Claude Design — `Tile` dans `bento-tiles.jsx`.
 */
export function Tile({ cat, data, height, size = 'md', rotate = 0, onPress }: TileProps) {
  const meta = CATEGORY_META[cat];
  const palette = PALETTES[data.paletteKey ?? 'neutral'];
  const conf = SIZE_CONF[size];
  const hasImage = Boolean(data.imageUrl);

  // Inner : tout le contenu clippé proprement par border + radius + overflow.
  const innerStyle: ViewStyle = {
    flex: 1,
    borderRadius: RADIUS,
    borderWidth: BORDER,
    borderColor: '#0a0a0a',
    backgroundColor: palette.colors[0],
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: conf.pad,
  };

  // Outer : porte la shadow stamp + la rotation. On ne peut PAS combiner
  // `shadow` et `overflow:hidden` sur la même View en RN (la shadow se fait
  // clipper). Wrapper externe pour la shadow + la rotation.
  const outerStyle: ViewStyle = {
    height,
    width: '100%',
    borderRadius: RADIUS,
    transform: [{ rotate: `${rotate}deg` }],
    ...SHADOWS.stamp,
  };

  const content = (
    <>
      {/* Background : image en plein cadre OU dégradé palette.
          NB : `inset: 0` n'est pas fiable sur RN 0.76 (l'Image rend à sa
          taille native en haut-gauche). On utilise `StyleSheet.absoluteFillObject`
          (top/left/right/bottom: 0) qui force le remplissage du parent. */}
      {hasImage ? (
        <Image
          source={{ uri: data.imageUrl }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
        />
      ) : (
        <LinearGradient
          colors={palette.colors}
          start={palette.start}
          end={palette.end}
          style={StyleSheet.absoluteFillObject}
        />
      )}

      {/* Overlay sombre du bas (lisibilité texte sur image) */}
      {hasImage ? (
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)']}
          start={{ x: 0.5, y: 0.3 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFillObject}
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
            lineHeight: conf.title * 1.0,
            letterSpacing: conf.letterSpacing,
            textTransform: 'uppercase',
            textShadowColor:
              hasImage || palette.ink === '#ffffff' ? 'rgba(0,0,0,0.4)' : 'transparent',
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
    </>
  );

  const inner = onPress ? (
    <Pressable onPress={onPress} style={innerStyle}>
      {content}
    </Pressable>
  ) : (
    <View style={innerStyle}>{content}</View>
  );

  return <View style={outerStyle}>{inner}</View>;
}
