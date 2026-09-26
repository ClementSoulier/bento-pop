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
import Svg, { Path, Rect } from 'react-native-svg';
import { TILE_MAX_FONT_MULTIPLIER, fontScaleFor } from './font-scaling';
import { PALETTES, type PaletteKey } from './palettes';
import { TILE_PENDING_RING, tileAccessibilityLabel, tilePendingBadge } from './tile-pending';
import {
  TILE_BORDER,
  TILE_LABEL_MAX_LINES,
  TILE_LINE,
  TILE_QUESTION_PADDING_H,
  TILE_STAMP_LETTER_SPACING,
  TILE_STAMP_PADDING_H,
  TILE_STAMP_PADDING_V,
  TILE_SUBTITLE_GAP,
  tileConf,
  tileLabelFit,
  tileLabelTextWidth,
  tileTextLayout,
  type TileSize,
} from './tile-text';
import { tileTitleFit, tileTitleScale } from './tile-title';
import { SHADOWS } from '@/components/primitives/shadow';
import { extendaAccentRoom } from '@/lib/display-title';
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
   * l'utilisateur, en attente de modération admin). Pose la pastille sablier,
   * cf. `tile-pending.ts`, et empêche la publication du bento tant qu'au moins
   * un slot est dans cet état.
   */
  pending?: boolean;
};

type TileProps = {
  /**
   * L'étiquette en haut de la tuile : le tampon court du bento principal,
   * « FILM », ou la question d'une édition, cf. `question`.
   */
  stamp: string;
  /**
   * `stamp` est la question d'une édition : jusqu'à deux lignes, une marge plus
   * serrée et une taille mesurée. Absent pour le bento principal, dont
   * l'étiquette reste exactement ce qu'elle était.
   */
  question?: boolean;
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
  question = false,
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
  // L'étiquette : un tampon, « FILM », sur une ligne ; ou la question d'une
  // édition, sur deux lignes au plus, cf. `filledCaseLabel`. Ses lignes se
  // comptent à la plus grande taille que la case lui donnera, réduite comme
  // elle le sera : jamais sous-estimées.
  const pixelRatio = Platform.OS === 'android' ? PixelRatio.get() : undefined;
  const labelPaddingH = question ? TILE_QUESTION_PADDING_H : TILE_STAMP_PADDING_H;
  const labelWidth =
    width === undefined ? 0 : tileLabelTextWidth(width, conf.pad, labelPaddingH);
  const labelLines = question
    ? tileLabelFit(
        stamp,
        labelWidth,
        conf.stamp * (allowFontScaling ? fontScaleFor(fontScale, TILE_MAX_FONT_MULTIPLIER) : 1),
        pixelRatio,
      ).lines
    : 1;
  // Une question sur deux lignes prend la place d'une ligne de plus : là où
  // elle ferait rétrécir le texte, le sous-titre s'efface d'abord, cf.
  // `tileTextLayout`. Une étiquette d'une ligne garde exactement le calcul
  // d'avant : le bento principal ne bouge pas.
  const layout = allowFontScaling
    ? tileTextLayout(height, size, scale, fontScale, labelLines)
    : labelLines > 1
      ? tileTextLayout(height, size, scale, 1, labelLines)
      : { textScale: 1, subtitle: true };
  const textScale = layout.textScale;
  // La question se réduit, jusqu'à 7 points, pour tenir en deux lignes : cf.
  // `tileLabelFontSize`. Sur deux lignes, le fond noir prend la largeur de la
  // plus longue, et non toute la largeur permise, avec une marge pour le rendu
  // de la plateforme, sans dépasser la case.
  const labelFit = question
    ? tileLabelFit(stamp, labelWidth, conf.stamp * textScale, pixelRatio)
    : null;
  const labelFontSize = labelFit ? labelFit.fontSize : conf.stamp * textScale;
  const labelBoxWidth =
    labelFit && labelFit.lines > 1
      ? Math.min(labelWidth, Math.ceil(labelFit.widest * 1.02 + 1)) + labelPaddingH * 2
      : undefined;
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
  // La place des accents de la première ligne du titre, que sa ligne de 1 em
  // rognait : « À BOUT DE SOUFFLE » perdait 2,0 pt de son accent sur 3,5 à la
  // recette du 26 septembre 2026. Cf. `display-title.ts`.
  const titleAccentRoom = extendaAccentRoom(title, conf.title * titleScale, pixelRatio);

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
          // La question d'une édition ne déborde pas de la case : elle passe
          // à la ligne dans la largeur que la case lui laisse.
          maxWidth:
            question && width !== undefined ? width - TILE_BORDER * 2 - conf.pad * 2 : undefined,
          width: labelBoxWidth,
          backgroundColor: hasImage ? '#0a0a0a' : palette.ink,
          paddingHorizontal: labelPaddingH,
          paddingVertical: TILE_STAMP_PADDING_V,
          borderRadius: 4,
          alignSelf: 'flex-start',
        }}
      >
        <Text
          allowFontScaling={false}
          numberOfLines={question ? TILE_LABEL_MAX_LINES : undefined}
          style={{
            color: hasImage ? '#ffffff' : palette.colors[0],
            fontFamily: 'Bungee',
            fontSize: labelFontSize,
            lineHeight: labelFontSize * TILE_LINE.stamp,
            letterSpacing: TILE_STAMP_LETTER_SPACING,
            textTransform: question ? 'uppercase' : undefined,
          }}
        >
          {stamp}
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
            // Rendue en marge négative : le bloc, ancré en bas de la case, garde
            // sa hauteur, et le titre sa place.
            paddingTop: titleAccentRoom,
            marginTop: -titleAccentRoom,
            textShadowColor:
              hasImage || palette.ink === '#ffffff' ? 'rgba(0,0,0,0.4)' : 'transparent',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 0,
          }}
        >
          {title}
        </Text>
        {data.subtitle && layout.subtitle ? (
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

  const a11yLabel = tileAccessibilityLabel({
    prompt,
    title,
    subtitle: data.subtitle,
    pending: data.pending,
  });
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

  // La pastille d'un item en attente, à cheval sur le coin haut droit : dans
  // `outer`, et non dans `inner`, qui rogne ce qui dépasse de la case. Elle ne
  // prend aucune place au texte, cf. `tile-pending.ts`.
  const badge = data.pending ? tilePendingBadge(size, scale) : null;

  return (
    <View style={outerStyle}>
      {inner}
      {badge ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -badge.overhang,
            right: -badge.overhang,
            width: badge.diameter,
            height: badge.diameter,
            borderRadius: badge.diameter / 2,
            borderWidth: TILE_PENDING_RING,
            borderColor: '#0a0a0a',
            backgroundColor: '#e63946',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Hourglass size={badge.diameter * 0.62} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * Sablier blanc de la pastille, dessiné comme les icônes de la barre d'onglets,
 * cf. `TabIcons.tsx` : une icône se dessine, elle ne dépend d'aucune police.
 */
function Hourglass({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="5" y="2.5" width="14" height="3" rx="1.2" fill="#ffffff" />
      <Rect x="5" y="18.5" width="14" height="3" rx="1.2" fill="#ffffff" />
      <Path
        d="M7.5 5.5 H16.5 C16.5 9.5 12.8 10.6 12.8 12 C12.8 13.4 16.5 14.5 16.5 18.5 H7.5 C7.5 14.5 11.2 13.4 11.2 12 C11.2 10.6 7.5 9.5 7.5 5.5 Z"
        fill="#ffffff"
      />
    </Svg>
  );
}
