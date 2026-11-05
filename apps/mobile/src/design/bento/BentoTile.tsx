import { CATEGORY_META } from '@bento-pop/supabase-mobile/bento';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  PixelRatio,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Mask,
  Pattern,
  Rect,
  Stop,
} from 'react-native-svg';
import type { CategoryKey } from '@/supabase/types';
import { Icon } from '../Icon';
import { PopShadow } from '../PopShadow';
import { Text } from '../Text';
import { useTheme } from '../theme';
import {
  TILE_RATIO,
  dotsFadeLine,
  tagQuestionFit,
  tagType,
  tileAccessibilityLabel,
  tileInitial,
  PENDING_BADGE,
  PENDING_GAP,
  emptyTileContent,
  tileMeasures,
  tilePrompt,
  tilePromptType,
  tileTextFit,
  tileTitleNudge,
  type BentoDensity,
  type TileSize,
} from './bento-rules';
import { CATEGORY_STYLES } from './categories';
import { Tag } from './Tag';

/** Ce qu'une case remplie montre de son item. */
export type BentoTileItem = {
  title: string;
  subtitle?: string;
  /** Obligatoire quand la licence de l'image le demande, et seulement avec une image. */
  credit?: string;
  imageUrl?: string;
  /** Un item proposé, en attente de validation : le sablier, et rien de publiable. */
  pending?: boolean;
};

export type BentoTileProps = {
  /** `null` : un type sans couleur, qui prend un repli neutre (D5). */
  category: CategoryKey | null;
  /** `xl` la grande, `l` une moyenne, `s` une petite. */
  size?: TileSize;
  density?: BentoDensity;
  /** `edit` montre le « + » d'une case vide ; `view`, une case vide sans rien. */
  mode?: 'edit' | 'view';
  item?: BentoTileItem | null;
  /** Ce qu'est la case, « Film », à défaut le libellé de sa catégorie. */
  label?: string;
  /** `label` est la question d'une édition. */
  question?: boolean;
  /** Le tampon de la case, « FILM », à défaut celui de sa catégorie. */
  stamp?: string;
  /** La case à remplir maintenant : contour plein et fond jaune pâle. */
  next?: boolean;
  onPress?: () => void;
  /** Dans un plateau, la hauteur de sa rangée. Seule, la case prend ses proportions. */
  minHeight?: number;
  /** Dans un plateau, sa largeur, que le titre mesure. Seule, la case la lit à sa mise en page. */
  width?: number;
};

/**
 * Une case du bento (chantiers 31 et 32). Vide, des pointillés, un « + » sur son
 * ombre et ce qu'elle attend. Remplie, l'image sous son voile et un texte blanc,
 * ou la couleur de sa catégorie, son initiale géante et ses pois ; la puce en
 * haut, le titre, le sous-titre et le crédit en bas, le sablier si l'item attend.
 *
 * Rien ne se chevauche (D7) : cf. `tileTextFit`.
 */
export function BentoTile(props: BentoTileProps) {
  return props.item ? <FilledTile {...props} item={props.item} /> : <EmptyTile {...props} />;
}

function EmptyTile({
  category,
  size = 'l',
  density = 'compose',
  mode = 'edit',
  label,
  question,
  stamp,
  next,
  onPress,
  minHeight,
}: BentoTileProps) {
  const { colors, border, palette } = useTheme();
  const { fontScale } = useWindowDimensions();
  const measures = tileMeasures(size, density);
  const text = label ?? (category ? CATEGORY_META[category].label : '');
  const { compact, plus, gap } = emptyTileContent({
    tile: size,
    minHeight,
    question,
    fontScale,
  });
  const frame = [
    minHeight === undefined ? { aspectRatio: TILE_RATIO[size] } : { flex: 1, minHeight },
    {
      padding: 10,
      gap,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: measures.radius,
      borderWidth: border.ink,
      borderStyle: next ? ('solid' as const) : ('dashed' as const),
      borderColor: next ? colors['text-primary'] : colors['border-strong'],
      backgroundColor: next ? colors['accent-soft'] : colors['bg-surface'],
    } as const,
  ];
  if (mode === 'view') {
    return <View accessible accessibilityLabel={`${text} : case vide`} style={frame} />;
  }
  const content = (
    <>
      <PopShadow level="pop-sm" radius={plus / 2}>
        <View
          style={{
            width: plus,
            height: plus,
            borderRadius: plus / 2,
            borderWidth: border.ink,
            borderColor: colors.ink,
            backgroundColor: colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="plus" size={compact ? 16 : 18} color="on-accent" />
        </View>
      </PopShadow>
      {question ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              borderWidth: 1.5,
              borderColor: palette['nori-900'],
              backgroundColor: category
                ? colors[CATEGORY_STYLES[category].color]
                : palette['yolk-300'],
            }}
          />
          <Text
            variant="eyebrow"
            color="text-secondary"
            style={{ fontSize: 11, lineHeight: 14, letterSpacing: 0.66 }}
          >
            {stamp}
          </Text>
        </View>
      ) : null}
      <Text
        variant="label-s"
        style={[tilePromptType(compact ? 's' : size, fontScale), { textAlign: 'center' }]}
      >
        {tilePrompt(text)}
      </Text>
    </>
  );
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={`${text} : case vide`} style={frame}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ajouter : ${text}`}
      onPress={onPress}
      style={frame}
    >
      {content}
    </Pressable>
  );
}

function FilledTile({
  category,
  size = 'l',
  density = 'compose',
  item,
  label,
  question,
  stamp,
  onPress,
  minHeight,
  width: givenWidth,
}: BentoTileProps & { item: BentoTileItem }) {
  const { colors, palette } = useTheme();
  const window = useWindowDimensions();
  const share = density === 'share';
  const fontScale = share ? 1 : window.fontScale;
  const pixelRatio = Platform.OS === 'android' && !share ? PixelRatio.get() : undefined;
  const measures = tileMeasures(size, density);
  const style = category ? CATEGORY_STYLES[category] : null;
  const hasImage = Boolean(item.imageUrl);
  const name = label ?? (category ? CATEGORY_META[category].label : '');

  // Seule, la case lit sa taille à sa mise en page ; dans un plateau, elle la
  // reçoit, et son texte tient dès le premier dessin.
  const [laid, setLaid] = useState<{ width: number; height: number }>();
  const width = givenWidth ?? laid?.width ?? 0;
  const height = laid?.height ?? minHeight ?? 0;

  const puce = tagType(fontScale);
  const questionFit =
    question && width > 0
      ? tagQuestionFit({
          question: name,
          width,
          tile: size,
          density,
          fontScale,
          pending: item.pending,
          pixelRatio,
        })
      : null;
  const questionLines = questionFit ? Math.min(2, questionFit.lines.length) : 1;
  const tagHeight = questionFit
    ? (puce.lineHeight * questionFit.fontSize * questionLines) / puce.fontSize +
      2 * puce.paddingVertical
    : puce.height;
  // Sur deux lignes, la puce prend la largeur de la plus longue, et non toute la
  // largeur permise, qui passerait sous le sablier ; avec une marge pour le rendu
  // de la plateforme.
  const tagWidth =
    questionFit && questionLines > 1
      ? Math.ceil(questionFit.widest * 1.02 + 1) + 2 * puce.paddingHorizontal
      : undefined;
  const tagRoom =
    (width - 2 * measures.tagInset - (item.pending ? PENDING_BADGE + PENDING_GAP : 0)) /
    measures.tagScale;
  const fit = tileTextFit({
    title: item.title,
    width,
    height,
    tile: size,
    density,
    fontScale,
    hasSubtitle: Boolean(item.subtitle),
    hasCredit: hasImage && Boolean(item.credit),
    tagHeight,
    pixelRatio,
  });

  const ink = hasImage ? colors['text-on-media'] : palette['nori-900'];
  const content = (
    <>
      {hasImage ? (
        <>
          <Image
            source={{ uri: item.imageUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={160}
            recyclingKey={item.imageUrl}
          />
          <LinearGradient
            colors={[
              'rgba(14,14,14,0.28)',
              'rgba(14,14,14,0)',
              'rgba(14,14,14,0)',
              colors['media-scrim'],
            ]}
            locations={[0, 0.26, 0.38, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </>
      ) : (
        <>
          <Text
            variant="display-m"
            importantForAccessibility="no"
            accessibilityElementsHidden
            style={{
              position: 'absolute',
              right: measures.initial.right,
              top: measures.initial.top,
              fontSize: measures.initial.fontSize,
              lineHeight: measures.initial.fontSize,
              letterSpacing: 0,
              opacity: 0.16,
              color: style ? colors[style.deep] : palette['nori-900'],
            }}
          >
            {tileInitial(item.title)}
          </Text>
          {style && width > 0 && height > 0 ? (
            <TileDots width={width} height={height} color={colors[style.deep]} />
          ) : null}
        </>
      )}
      <View
        style={{
          position: 'absolute',
          top: measures.tagInset,
          left: measures.tagInset,
          // La puce grandit par une échelle, à partir de son coin : sa largeur se compte avant.
          width: tagWidth === undefined || width <= 0 ? undefined : Math.min(tagWidth, tagRoom),
          maxWidth: width > 0 ? tagRoom : undefined,
          transform: share ? [{ scale: measures.tagScale }] : undefined,
          transformOrigin: share ? 'left top' : undefined,
        }}
      >
        <Tag
          category={category}
          label={question ? name : stamp}
          fontSize={questionFit?.fontSize}
          fontScale={fontScale}
        />
      </View>
      {item.pending ? <PendingBadge /> : null}
      <View style={{ flex: 1, justifyContent: 'flex-end', padding: measures.padding }}>
        <Text
          variant={size === 'xl' ? 'tile-xl' : size === 'l' ? 'tile-l' : 'tile-m'}
          numberOfLines={fit.titleLines}
          // Android, avec ses réglages par défaut, coupe au milieu d'un mot et refuse
          // de couper après un trait d'union (chantier 7). Sa césure ne sert plus :
          // `tileTextFit` fait tenir le plus long mot sur une ligne.
          textBreakStrategy="simple"
          android_hyphenationFrequency="normal"
          style={[
            fit.title,
            {
              color: ink,
              transform: [
                {
                  translateY: tileTitleNudge(
                    size,
                    Platform.OS === 'ios' ? 'ios' : 'android',
                    fit.title.fontSize,
                  ),
                },
              ],
            },
          ]}
        >
          {item.title}
        </Text>
        {fit.subtitle ? (
          <Text
            variant="footnote"
            numberOfLines={1}
            style={{
              marginTop: fit.subtitle.gap,
              fontSize: fit.subtitle.fontSize,
              lineHeight: fit.subtitle.lineHeight,
              fontWeight: '500',
              opacity: 0.92,
              color: ink,
            }}
          >
            {item.subtitle}
          </Text>
        ) : null}
        {fit.credit ? (
          <Text
            variant="footnote"
            numberOfLines={1}
            style={{
              marginTop: fit.credit.gap,
              fontSize: fit.credit.fontSize,
              lineHeight: fit.credit.lineHeight,
              opacity: 0.78,
              color: ink,
            }}
          >
            {item.credit}
          </Text>
        ) : null}
      </View>
    </>
  );

  const frame = [
    minHeight === undefined ? { aspectRatio: TILE_RATIO[size] } : { flex: 1, minHeight },
    {
      overflow: 'hidden',
      borderRadius: measures.radius,
      backgroundColor: style ? colors[style.color] : colors['bg-sunken'],
    } as const,
  ];
  const onLayout = (event: { nativeEvent: { layout: { width: number; height: number } } }) => {
    const { width: w, height: h } = event.nativeEvent.layout;
    setLaid((seen) => (seen?.width === w && seen.height === h ? seen : { width: w, height: h }));
  };
  const a11y = tileAccessibilityLabel({
    label: name,
    title: item.title,
    subtitle: item.subtitle,
    pending: item.pending,
  });
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={a11y} onLayout={onLayout} style={frame}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityHint="Modifie cette case du bento"
      onPress={onPress}
      onLayout={onLayout}
      style={frame}
    >
      {content}
    </Pressable>
  );
}

/** Le sablier d'un item qui attend : 28 points cerclés d'encre, en haut à droite. */
function PendingBadge() {
  const { border, palette } = useTheme();
  return (
    <View
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: border.ink,
        borderColor: palette['nori-900'],
        backgroundColor: palette['yolk-300'],
      }}
    >
      <Icon name="hourglass-medium" size={15} tint={palette['nori-900']} />
    </View>
  );
}

/**
 * Les pois d'une case sans image, un tous les 12 points, estompés depuis le haut
 * à droite : le `radial-gradient` et le `mask-image` du dossier.
 */
function TileDots({ width, height, color }: { width: number; height: number; color: string }) {
  const line = dotsFadeLine(width, height);
  return (
    <Svg
      width={width}
      height={height}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Defs>
        <Pattern id="pois" width={12} height={12} patternUnits="userSpaceOnUse">
          <Circle cx={6} cy={6} r={1.45} fill={color} />
        </Pattern>
        <SvgGradient id="estompe" gradientUnits="userSpaceOnUse" {...line}>
          <Stop offset={0} stopColor="#ffffff" stopOpacity={1} />
          <Stop offset={0.6} stopColor="#ffffff" stopOpacity={0} />
        </SvgGradient>
        <Mask id="masque" maskUnits="userSpaceOnUse" x={0} y={0} width={width} height={height}>
          <Rect width={width} height={height} fill="url(#estompe)" />
        </Mask>
      </Defs>
      <Rect width={width} height={height} fill="url(#pois)" mask="url(#masque)" opacity={0.18} />
    </Svg>
  );
}
