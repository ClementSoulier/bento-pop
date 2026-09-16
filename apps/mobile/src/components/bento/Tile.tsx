import {
  PixelRatio,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { TILE_MAX_FONT_MULTIPLIER } from './font-scaling';
import { PALETTES, type PaletteKey } from './palettes';
import {
  TILE_BORDER,
  TILE_LINE,
  TILE_STAMP_PADDING_V,
  TILE_SUBTITLE_GAP,
  tileConf,
  tileTextScale,
  type TileSize,
} from './tile-text';
import { tileTitleFit, tileTitleScale } from './tile-title';
import { SHADOWS } from '@/components/primitives/shadow';
import { cleanTitle } from '@/lib/text';

export type { TileSize };

export type TileData = {
  title: string;
  subtitle?: string;
  /** URL d'une vraie image (poster TMDb, cover MusicBrainz…). */
  imageUrl?: string;
  /**
   * Texte d'attribution (auteur + licence) à afficher en mini sous le
   * visuel. Obligatoire pour les images Wikimedia CC-BY-SA. Si null/undef,
   * pas de crédit affiché.
   */
  imageCredit?: string;
  /** Palette de fallback / overlay décoratif. */
  paletteKey?: PaletteKey;
  /**
   * `true` si l'item référencé est `status='pending'` (proposé par
   * l'utilisateur, en attente de modération admin). Affiche un badge et
   * empêche la publication du bento tant qu'au moins un slot est dans
   * cet état.
   */
  pending?: boolean;
};

type TileProps = {
  /** Tampon court affiché en haut de la tuile. */
  stamp: string;
  /** Intitulé de la case, lu par les lecteurs d'écran. */
  prompt: string;
  data: TileData;
  height: number;
  /**
   * Largeur de la case, cadre compris, que la grille calcule, cf.
   * `BentoGrid.width`. Le titre y mesure son premier mot.
   */
  width?: number;
  size?: TileSize;
  /** Échelle propagée depuis BentoGrid. Sert à scaler proportionnellement
   *  les paddings / stamps / titres pour ne pas avoir une grille qui
   *  rétrécit mais des stamps qui restent à leur taille absolue. */
  scale?: number;
  rotate?: number;
  onPress?: () => void;
  /**
   * `false` pour une case qui ne doit pas suivre la police système : celle de
   * l'image de partage. Cf. `BentoGrid.allowFontScaling`.
   */
  allowFontScaling?: boolean;
};

/** Première lettre du titre — pour le fallback visuel signature. */
function getInitial(s: string): string {
  const match = s.trim().match(/[A-Za-zÀ-ÿ0-9]/);
  return (match?.[0] ?? '?').toUpperCase();
}

const RADIUS = 18;

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
export function Tile({
  stamp,
  prompt,
  data,
  height,
  width,
  size = 'md',
  scale = 1,
  rotate = 0,
  onPress,
  allowFontScaling = true,
}: TileProps) {
  const palette = PALETTES[data.paletteKey ?? 'neutral'];
  // Applique le scale aux dims qui font la mise en page : cf. `tileConf`.
  const conf = tileConf(size, scale);
  const hasImage = Boolean(data.imageUrl);
  const title = cleanTitle(data.title);
  const titleFit = tileTitleFit(title);
  // L'étiquette, le titre et le sous-titre appliquent eux-mêmes la police
  // système, hauteurs de ligne comprises, sans dépasser ce que la case permet :
  // cf. `tileTextScale`. Figée à 1 quand la grille ne suit pas le système.
  const { fontScale } = useWindowDimensions();
  const textScale = allowFontScaling ? tileTextScale(height, size, scale, fontScale) : 1;
  // Le titre rétrécit encore jusqu'à tenir entier dans ses deux lignes, sans
  // descendre sous `TITLE_MIN_SCALE`, et toujours assez pour que son premier mot
  // ne se coupe pas au milieu : cf. `tileTitleScale`. Un mot seul, lui, remplit
  // sa ligne au plus. La mesure prend la taille qu'Android arrondit au pixel
  // supérieur.
  const titleScale =
    textScale *
    tileTitleScale(
      title,
      width === undefined ? 0 : width - TILE_BORDER * 2 - conf.pad * 2,
      conf.title * textScale,
      conf.letterSpacing,
      Platform.OS === 'android' ? PixelRatio.get() : undefined,
    );

  // Inner : border + radius + overflow:hidden, SANS padding. Le bg est noir
  // (même couleur que la bordure) pour blender avec celle-ci en cas de
  // gap sub-pixel sur iOS — sinon on voit un liseré clair (palette.colors[0])
  // entre la bordure et l'image (l'iOS rendering de overflow:hidden+borderRadius
  // ne s'aligne pas toujours pixel-perfect avec un <Image>).
  const innerStyle: ViewStyle = {
    flex: 1,
    borderRadius: RADIUS,
    borderWidth: TILE_BORDER,
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
        <>
          {/* Placeholder coloré sous l'image. La palette est déterministe
              par item, donc la case a déjà SA couleur pendant le
              téléchargement — un fil qui charge reste un fil coloré, pas
              une suite de rectangles noirs.

              Inséré à 1px des bords, et non en absoluteFill : l'inner a un
              fond noir volontaire pour masquer le liseré sub-pixel entre la
              bordure et l'image sur iOS (cf. commentaire de `innerStyle`).
              Un gradient à fleur de bord réintroduirait exactement ce
              liseré clair. */}
          <LinearGradient
            colors={palette.colors}
            start={palette.start}
            end={palette.end}
            style={{ position: 'absolute', top: 1, left: 1, right: 1, bottom: 1 }}
            pointerEvents="none"
          />
          <Image
            source={{ uri: data.imageUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            // `memory-disk` et non le défaut `disk` : au défilement rapide
            // du fil, le cache mémoire évite un aller-retour disque par
            // case revenant à l'écran.
            cachePolicy="memory-disk"
            // Fondu court : sans lui l'image apparaît d'un coup par-dessus
            // le placeholder, ce qui saute à l'œil sur une liste.
            transition={160}
            // Sans `recyclingKey`, une cellule FlatList recyclée affiche
            // brièvement l'image de la précédente avant de charger la
            // sienne. L'URL identifie l'item de façon stable.
            recyclingKey={data.imageUrl}
          />
        </>
      ) : (
        <>
          <LinearGradient
            colors={palette.colors}
            start={palette.start}
            end={palette.end}
            style={StyleSheet.absoluteFill}
          />
          {/* Initiale "stamp" en filigrane décalée vers le haut-droit pour
              ne pas concurrencer le titre en bas. Légère rotation pour
              casser la symétrie et donner un feel "tampon" plutôt que
              "blob centré". Opacité contenue à 0.12. */}
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { alignItems: 'flex-end', justifyContent: 'flex-start', padding: conf.pad },
            ]}
          >
            <Text
              // Un filigrane dimensionné sur la case, pas un texte à lire.
              allowFontScaling={false}
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
              {getInitial(title)}
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
          style={StyleSheet.absoluteFill}
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
          paddingVertical: TILE_STAMP_PADDING_V,
          borderRadius: 4,
          alignSelf: 'flex-start',
        }}
      >
        <Text
          allowFontScaling={false}
          style={{
            color: hasImage ? '#ffffff' : palette.colors[0],
            fontFamily: 'Bungee',
            fontSize: conf.stamp * textScale,
            lineHeight: conf.stamp * TILE_LINE.stamp * textScale,
            letterSpacing: 1,
          }}
        >
          {stamp}
        </Text>
      </View>

      {data.pending ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: conf.pad,
            right: conf.pad,
            backgroundColor: '#e63946',
            paddingHorizontal: 6,
            paddingVertical: TILE_STAMP_PADDING_V,
            borderRadius: 4,
            transform: [{ rotate: '4deg' }],
          }}
        >
          <Text
            allowFontScaling={false}
            style={{
              color: '#ffffff',
              fontFamily: 'Bungee',
              fontSize: conf.stamp * textScale,
              lineHeight: conf.stamp * TILE_LINE.stamp * textScale,
              letterSpacing: 1,
            }}
          >
            En attente
          </Text>
        </View>
      ) : null}

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
          // Deux lignes, ou une seule pour un mot seul, à une taille mesurée :
          // jamais `adjustsFontSizeToFit`, qui combiné à `lineHeight` réduisait
          // le titre à 5 pt sur iOS. Cf. `tile-title.ts`.
          numberOfLines={titleFit.numberOfLines}
          adjustsFontSizeToFit={titleFit.adjustsFontSizeToFit}
          allowFontScaling={false}
          // Android, avec ses réglages par défaut, coupe au milieu un mot trop
          // long pour la ligne (« JIMMY PU / NCHLINE ») et refuse de couper
          // après un trait d'union (« MERRY-G / O-ROUN… »). Coupure simple et
          // césure normale : il coupe entre deux mots ou après un trait d'union,
          // et tronque sa fin comme iOS, « JIMMY / PUNCHLI… », « MERRY- /
          // GO-ROU… ». Sa césure ne sert qu'à un premier mot plus large que la
          // ligne, « SLEEP- / LESS », que `tileTitleScale` fait désormais
          // tenir. Mesuré sur l'émulateur Pixel 8 ; iOS ignore les deux.
          textBreakStrategy="simple"
          android_hyphenationFrequency="normal"
          style={{
            color: hasImage ? '#ffffff' : palette.ink,
            fontFamily: 'Extenda',
            fontSize: conf.title * titleScale,
            lineHeight: conf.title * TILE_LINE.title * titleScale,
            letterSpacing: conf.letterSpacing,
            textTransform: 'uppercase',
            textShadowColor:
              hasImage || palette.ink === '#ffffff' ? 'rgba(0,0,0,0.4)' : 'transparent',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 0,
          }}
        >
          {title}
        </Text>
        {data.subtitle ? (
          <Text
            numberOfLines={1}
            allowFontScaling={false}
            style={{
              marginTop: TILE_SUBTITLE_GAP,
              color: hasImage ? 'rgba(255,255,255,0.85)' : palette.ink,
              fontSize: conf.sub * textScale,
              lineHeight: conf.sub * TILE_LINE.subtitle * textScale,
              fontWeight: '500',
              letterSpacing: 0.3,
              opacity: hasImage ? 1 : 0.85,
            }}
          >
            {data.subtitle}
          </Text>
        ) : null}
      </View>

      {/* Crédit photo : obligation légale pour les images Wikimedia
          (CC-BY-SA). Tucké en bas à droite, très petit, semi-transparent
          pour ne pas concurrencer le design. N'apparait que si l'image
          est présente ET un crédit est posé en BDD. */}
      {hasImage && data.imageCredit ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            right: 4,
            bottom: 4,
            maxWidth: '70%',
          }}
        >
          <Text
            numberOfLines={1}
            allowFontScaling={allowFontScaling}
            maxFontSizeMultiplier={TILE_MAX_FONT_MULTIPLIER}
            style={{
              color: 'rgba(255,255,255,0.5)',
              fontSize: Math.max(7, conf.stamp - 2),
              fontFamily: 'Fredoka',
              letterSpacing: 0.2,
              textAlign: 'right',
            }}
          >
            {data.imageCredit}
          </Text>
        </View>
      ) : null}
    </>
  );

  const a11yLabel = `${prompt} : ${title}${data.subtitle ? `, ${data.subtitle}` : ''}`;
  const inner = onPress ? (
    <Pressable
      onPress={onPress}
      style={innerStyle}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint="Modifie cette case du bento"
    >
      {content}
    </Pressable>
  ) : (
    // `accessible` : la case se lit d'un bloc. Sans lui, VoiceOver lisait ses
    // trois textes l'un après l'autre sur la page publique, l'initiale en
    // filigrane comprise : « I », « FILM », « INCEPTION ». Et pas de rôle
    // `image` : une case n'est pas une image, et le mot serait annoncé.
    <View style={innerStyle} accessible accessibilityLabel={a11yLabel}>
      {content}
    </View>
  );

  return <View style={outerStyle}>{inner}</View>;
}
