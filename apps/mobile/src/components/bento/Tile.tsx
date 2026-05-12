import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { CategoryKey } from '@/supabase/types';
import { CATEGORY_META } from './categories';
import { PALETTES, type PaletteKey } from './palettes';
import { SHADOWS } from '@/components/primitives/shadow';
import { cleanTitle } from '@/lib/text';

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
  /** Échelle propagée depuis BentoGrid. Sert à scaler proportionnellement
   *  les paddings / stamps / titres pour ne pas avoir une grille qui
   *  rétrécit mais des stamps qui restent à leur taille absolue. */
  scale?: number;
  rotate?: number;
  onPress?: () => void;
};

/**
 * Config par taille. `letterSpacing` positif pour aérer la police Extenda
 * Yotta dont le crénage natif est très serré ; sans ça les lettres se
 * touchent (« SEVERANCE », « ORELSAN » illisibles).
 * `initial` = taille de la grosse initiale du fallback visuel (rendue en
 * filigrane derrière le gradient quand pas de photo).
 */
const SIZE_CONF: Record<TileSize, {
  title: number;
  sub: number;
  pad: number;
  stamp: number;
  letterSpacing: number;
  initial: number;
}> = {
  lg: { title: 28, sub: 13, pad: 16, stamp: 9, letterSpacing: 1.2, initial: 140 },
  md: { title: 17, sub: 11, pad: 12, stamp: 9, letterSpacing: 0.8, initial: 96 },
  sm: { title: 13, sub: 9.5, pad: 9, stamp: 8, letterSpacing: 0.5, initial: 68 },
};

/** Première lettre du titre — pour le fallback visuel signature. */
function getInitial(s: string): string {
  const match = s.trim().match(/[A-Za-zÀ-ÿ0-9]/);
  return (match?.[0] ?? '?').toUpperCase();
}

const RADIUS = 18;
const BORDER = 2.5;

/**
 * Tile remplie d'un compartiment bento.
 *
 * Structure en 3 couches DANS la border-box (le inner n'a PAS de padding —
 * sinon les enfants `position: absolute` s'inscrivent dans la content-box
 * et laissent paraître un liseré de la palette autour de l'image) :
 *   1. Background (image OU gradient + initiale) : fill total
 *   2. Overlay sombre pour lisibilité du texte (si image)
 *   3. Content (stamp + titre) : positionné en absolute, offset = conf.pad
 *      depuis chaque bord — simule le padding sans contaminer le background
 *
 * Cf. design Claude Design — `Tile` dans `bento-tiles.jsx`.
 */
export function Tile({ cat, data, height, size = 'md', scale = 1, rotate = 0, onPress }: TileProps) {
  const meta = CATEGORY_META[cat];
  const palette = PALETTES[data.paletteKey ?? 'neutral'];
  const baseConf = SIZE_CONF[size];
  // Applique le scale aux dims qui font la mise en page (paddings, fontSize
  // du titre/sub/stamp). Le `letterSpacing` reste constant (déjà serré).
  // Plancher à 0.7 pour ne pas avoir de stamps illisibles sur petit écran.
  const s = Math.max(0.7, scale);
  const conf = {
    title: Math.round(baseConf.title * s),
    sub: Math.round(baseConf.sub * s),
    pad: Math.round(baseConf.pad * s),
    stamp: Math.max(7, Math.round(baseConf.stamp * s)),
    letterSpacing: baseConf.letterSpacing,
    initial: Math.round(baseConf.initial * s),
  };
  const hasImage = Boolean(data.imageUrl);

  // Inner : border + radius + overflow:hidden, SANS padding. Le bg est noir
  // (même couleur que la bordure) pour blender avec celle-ci en cas de
  // gap sub-pixel sur iOS — sinon on voit un liseré clair (palette.colors[0])
  // entre la bordure et l'image (l'iOS rendering de overflow:hidden+borderRadius
  // ne s'aligne pas toujours pixel-perfect avec un <Image>).
  const innerStyle: ViewStyle = {
    flex: 1,
    borderRadius: RADIUS,
    borderWidth: BORDER,
    borderColor: '#0a0a0a',
    backgroundColor: '#0a0a0a',
    overflow: 'hidden',
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
      {/* COUCHE 1 — Background : image plein cadre OU gradient + initiale */}
      {hasImage ? (
        <Image
          source={{ uri: data.imageUrl }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
        />
      ) : (
        <>
          <LinearGradient
            colors={palette.colors}
            start={palette.start}
            end={palette.end}
            style={StyleSheet.absoluteFillObject}
          />
          {/* Initiale "stamp" en filigrane décalée vers le haut-droit pour
              ne pas concurrencer le titre en bas. Légère rotation pour
              casser la symétrie et donner un feel "tampon" plutôt que
              "blob centré". Opacité contenue à 0.12. */}
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              { alignItems: 'flex-end', justifyContent: 'flex-start', padding: conf.pad },
            ]}
          >
            <Text
              style={{
                fontFamily: 'Extenda',
                fontSize: conf.initial,
                lineHeight: conf.initial * 0.85,
                color: palette.ink,
                opacity: 0.12,
                letterSpacing: -2,
                textTransform: 'uppercase',
                transform: [{ rotate: '-6deg' }],
                marginTop: -conf.initial * 0.15,
              }}
            >
              {getInitial(cleanTitle(data.title))}
            </Text>
          </View>
        </>
      )}

      {/* COUCHE 2 — Overlay sombre du bas (lisibilité texte si image) */}
      {hasImage ? (
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)']}
          start={{ x: 0.5, y: 0.3 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
      ) : null}

      {/* COUCHE 3 — Content : stamp haut-gauche + titre bas. Offsets =
          conf.pad pour simuler un padding sans casser la couche background. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: conf.pad,
          left: conf.pad,
          backgroundColor: hasImage ? '#0a0a0a' : palette.ink,
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 4,
          alignSelf: 'flex-start',
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

      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: conf.pad,
          left: conf.pad,
          right: conf.pad,
        }}
      >
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
          {cleanTitle(data.title)}
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
