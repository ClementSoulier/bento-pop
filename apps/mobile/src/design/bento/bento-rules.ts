/**
 * Les mesures du bento (chantiers 31 et 32), celles de `bundle.css` en densités
 * `compose` et `share`, et ce qu'une case garde selon sa place. Aucun import de
 * `react-native` : les tests lisent ce module sous `node:test`.
 */
import {
  CATEGORY_META,
  boxPlacements,
  boxRowHeights,
  fitLabel,
  type LabelFit,
} from '@bento-pop/supabase-mobile/bento';
import { FIXED_MAX_FONT_MULTIPLIER, scaledType } from '@/components/bento/font-scaling';
import type { CategoryKey } from '@/supabase/types';
import { border, radius, size } from '../tokens';
import { tagLabelWidth, tileTitleWidth } from './tile-metrics';

export type TileSize = 'xl' | 'l' | 's';

/** `compose` dans le composer et l'accueil, `share` sur l'image partagée. */
export type BentoDensity = 'compose' | 'share';

/** Le plateau : une grande case, deux moyennes, trois petites. */
export const BENTO_ROWS: readonly (readonly { category: CategoryKey; size: TileSize }[])[] = [
  [{ category: 'film', size: 'xl' }],
  [
    { category: 'series', size: 'l' },
    { category: 'artist', size: 'l' },
  ],
  [
    { category: 'track', size: 's' },
    { category: 'creator', size: 's' },
    { category: 'place', size: 's' },
  ],
];

/** Largeur sur hauteur : 2 / 1 pour la grande en composition, 6 / 5, puis le carré. */
export const TILE_RATIO: Record<TileSize, number> = { xl: 2, l: 6 / 5, s: 1 };

const SHARE_RATIO: Record<TileSize, number> = { xl: 23 / 10, l: 7 / 5, s: 20 / 17 };

const RATIOS: Record<BentoDensity, Record<TileSize, number>> = {
  compose: TILE_RATIO,
  share: SHARE_RATIO,
};

/** Le contour, la marge et l'écart du plateau, son rayon et le décalage de son ombre. */
export const PLATE: Record<
  BentoDensity,
  { border: number; padding: number; gap: number; radius: number; shadow: number }
> = {
  compose: {
    border: border.ink,
    padding: size['plate-padding'],
    gap: size['plate-gap'],
    radius: radius.xl,
    shadow: 5,
  },
  share: { border: 5, padding: 14, gap: 12, radius: 56, shadow: 12 },
};

/** La largeur intérieure d'un plateau, sans son contour ni sa marge. */
function plateInner(plateWidth: number, density: BentoDensity): number {
  return plateWidth - 2 * (PLATE[density].border + PLATE[density].padding);
}

/**
 * La hauteur de chaque rangée pour un plateau de cette largeur. C'est un
 * minimum, comme `aspect-ratio` en CSS : une case vide grandit plutôt que de
 * couper son libellé quand le texte du système monte.
 */
export function tileMinHeights(
  plateWidth: number,
  density: BentoDensity = 'compose',
): Record<TileSize, number> {
  const inner = plateInner(plateWidth, density);
  const { gap } = PLATE[density];
  const ratio = RATIOS[density];
  return {
    xl: inner / ratio.xl,
    l: (inner - gap) / 2 / ratio.l,
    s: (inner - 2 * gap) / 3 / ratio.s,
  };
}

/** La hauteur d'un plateau de cette largeur, ses trois rangées posées. */
export function plateMinHeight(plateWidth: number, density: BentoDensity = 'compose'): number {
  const { xl, l, s } = tileMinHeights(plateWidth, density);
  const { gap, border: outline, padding } = PLATE[density];
  return xl + l + s + 2 * gap + 2 * (outline + padding);
}

/** Une rangée du plateau : le gabarit de ses cases, leur nombre, leur hauteur. */
export type PlateRow = { size: TileSize; cases: number; height: number };

const SIZE_BY_CASES: Record<number, TileSize> = { 1: 'xl', 2: 'l', 3: 's' };

/**
 * Les rangées d'un plateau de 2 à 6 cases (D6) : les dispositions de Rob, sur le
 * plateau du design. À six, les proportions du dossier ; en dessous, le plateau
 * garde sa hauteur, partagée selon `BOX_LAYOUTS`. `heightScale` : la hauteur que
 * le composer rend à ce qui l'entoure sur un écran court (D8).
 */
export function plateRows(
  count: number,
  plateWidth: number,
  density: BentoDensity = 'compose',
  heightScale = 1,
): readonly PlateRow[] {
  const shape: { cases: number; height: number }[] = [];
  const shares = boxRowHeights(count);
  const places = boxPlacements(count);
  if (shares.length === 0) return [];
  const { gap } = PLATE[density];
  const heights = tileMinHeights(plateWidth, density);
  const rowsTotal = heights.xl + heights.l + heights.s + 2 * gap - (shares.length - 1) * gap;
  const shareTotal = shares.reduce((sum, share) => sum + share, 0);
  shares.forEach((share, index) => {
    const cases = places.filter((place) => place.row === index + 1).length;
    shape.push({ cases, height: (rowsTotal * share) / shareTotal });
  });
  return shape.map(({ cases, height }) => {
    const tile = SIZE_BY_CASES[cases] ?? 's';
    return {
      size: tile,
      cases,
      height: (count === 6 ? heights[tile] : height) * heightScale,
    };
  });
}

/** La largeur d'une case d'une rangée de `cases` cases. */
export function tileWidth(
  plateWidth: number,
  cases: number,
  density: BentoDensity = 'compose',
): number {
  return (plateInner(plateWidth, density) - (cases - 1) * PLATE[density].gap) / cases;
}

/** Un plateau d'illustration ne rapetisse pas au-delà : l'écran défile alors. */
const MIN_ILLUSTRATION_SCALE = 0.72;

/**
 * L'échelle d'un plateau d'illustration, pour qu'il laisse tenir la phrase et
 * le bouton sur un écran court. Le texte passe avant le décor.
 */
export function illustrationScale(room: number, plateHeight: number): number {
  return Math.max(MIN_ILLUSTRATION_SCALE, Math.min(1, room / plateHeight));
}

/**
 * Le libellé d'une case vide, 14/17, 12/14 dans une petite : deux styles que le
 * système n'a pas. Posé dans une hauteur qu'il ne décide pas, il s'arrête à
 * 130 %, comme le texte d'une case.
 */
export function tilePromptType(tile: TileSize, fontScale: number) {
  return tile === 's'
    ? scaledType(fontScale, FIXED_MAX_FONT_MULTIPLIER, 12, 14)
    : scaledType(fontScale, FIXED_MAX_FONT_MULTIPLIER, 14, 17);
}

/**
 * Le libellé tel qu'une case l'écrit : « de » reste avec le mot qui le suit,
 * « Créateur / de contenu » comme sur la maquette. React Native n'a pas
 * l'équilibrage des lignes de `text-wrap: balance`.
 */
export function tilePrompt(label: string): string {
  return label.replace(/ de /g, ' de ');
}

/** Le plateau vide se lit d'un seul libellé : les six catégories, dans l'ordre. */
export function emptyBentoLabel(): string {
  const categories = BENTO_ROWS.flat().map(({ category }) =>
    CATEGORY_META[category].label.toLocaleLowerCase('fr'),
  );
  return `Un bento vide, six cases : ${categories.join(', ')}`;
}

// ─── Une case remplie ───────────────────────────────────────────────────

type TextMeasure = { fontSize: number; lineHeight: number; letterSpacing?: number; gap?: number };

/** Ce que `bundle.css` donne à une case, par gabarit et par densité. */
export type TileMeasures = {
  radius: number;
  /** La marge autour du texte du bas. */
  padding: number;
  /** La place de la puce depuis le haut et la gauche de la case. */
  tagInset: number;
  /** L'échelle de la puce : 2,4 sur l'image partagée. */
  tagScale: number;
  title: Required<Omit<TextMeasure, 'gap'>> & { maxLines: number };
  subtitle: Required<Omit<TextMeasure, 'letterSpacing'>>;
  credit: Required<Omit<TextMeasure, 'letterSpacing'>>;
  /** L'initiale géante : sa taille, et sa place en part de la case. */
  initial: { fontSize: number; right: `${number}%`; top: `${number}%` };
};

const COMPOSE_MEASURES: Record<TileSize, TileMeasures> = {
  xl: {
    radius: radius.lg,
    padding: 16,
    tagInset: 12,
    tagScale: 1,
    title: { fontSize: 28, lineHeight: 28, letterSpacing: 0.28, maxLines: 2 },
    subtitle: { fontSize: 13, lineHeight: 16, gap: 4 },
    credit: { fontSize: 10, lineHeight: 12, gap: 3 },
    initial: { fontSize: 220, right: '-4%', top: '-14%' },
  },
  l: {
    radius: radius.lg,
    padding: 12,
    tagInset: 10,
    tagScale: 1,
    title: { fontSize: 20, lineHeight: 21, letterSpacing: 0.2, maxLines: 3 },
    subtitle: { fontSize: 13, lineHeight: 16, gap: 4 },
    credit: { fontSize: 10, lineHeight: 12, gap: 3 },
    initial: { fontSize: 150, right: '-4%', top: '-14%' },
  },
  s: {
    radius: radius.md,
    padding: 9,
    tagInset: 8,
    tagScale: 1,
    title: { fontSize: 15, lineHeight: 15, letterSpacing: 0.225, maxLines: 3 },
    subtitle: { fontSize: 11, lineHeight: 14, gap: 3 },
    credit: { fontSize: 10, lineHeight: 12, gap: 3 },
    initial: { fontSize: 104, right: '-8%', top: '-12%' },
  },
};

const SHARE_MEASURES: Record<TileSize, TileMeasures> = {
  xl: {
    radius: 36,
    padding: 30,
    tagInset: 26,
    tagScale: 2.4,
    title: { fontSize: 84, lineHeight: 78, letterSpacing: 0.84, maxLines: 2 },
    subtitle: { fontSize: 30, lineHeight: 36, gap: 10 },
    credit: { fontSize: 18, lineHeight: 22, gap: 6 },
    initial: { fontSize: 560, right: '-4%', top: '-14%' },
  },
  l: {
    radius: 36,
    padding: 30,
    tagInset: 26,
    tagScale: 2.4,
    title: { fontSize: 58, lineHeight: 54, letterSpacing: 0.58, maxLines: 3 },
    subtitle: { fontSize: 30, lineHeight: 36, gap: 10 },
    credit: { fontSize: 18, lineHeight: 22, gap: 6 },
    initial: { fontSize: 380, right: '-4%', top: '-14%' },
  },
  s: {
    radius: 26,
    padding: 20,
    tagInset: 26,
    tagScale: 2.4,
    title: { fontSize: 40, lineHeight: 38, letterSpacing: 0.6, maxLines: 3 },
    subtitle: { fontSize: 24, lineHeight: 30, gap: 10 },
    credit: { fontSize: 18, lineHeight: 22, gap: 6 },
    initial: { fontSize: 260, right: '-8%', top: '-12%' },
  },
};

export function tileMeasures(tile: TileSize, density: BentoDensity = 'compose'): TileMeasures {
  return density === 'share' ? SHARE_MEASURES[tile] : COMPOSE_MEASURES[tile];
}

/** Les mesures d'un texte à la taille du système, arrêtée à 130 %, comme le texte d'une case. */
function scaled<T extends { fontSize: number; lineHeight: number; gap?: number }>(
  measure: T,
  fontScale: number,
): T {
  const { fontSize, lineHeight } = scaledType(
    fontScale,
    FIXED_MAX_FONT_MULTIPLIER,
    measure.fontSize,
    measure.lineHeight,
  );
  return { ...measure, fontSize, lineHeight };
}

/** Une ligne de puce fait 14 de haut, 22 avec ses marges. */
const TAG = { fontSize: 11, lineHeight: 14, em: 0.08, paddingH: 8, paddingV: 4 };

/** Le texte d'une puce à la taille du système, 22 de haut par défaut. */
export function tagType(fontScale: number) {
  const type = scaledType(fontScale, FIXED_MAX_FONT_MULTIPLIER, TAG.fontSize, TAG.lineHeight);
  return {
    ...type,
    letterSpacing: Math.round(type.fontSize * TAG.em * 100) / 100,
    paddingHorizontal: TAG.paddingH,
    paddingVertical: TAG.paddingV,
    /** La hauteur de la puce d'une ligne. */
    height: type.lineHeight + 2 * TAG.paddingV,
  };
}

/** La question ne descend pas sous cette taille : elle se coupe plutôt. */
const QUESTION_MIN_FONT = 9;
/** La largeur de la pastille d'attente, et son écart avec la puce. */
export const PENDING_BADGE = 28;
export const PENDING_GAP = 4;

/** La hauteur en dessous de laquelle une case vide prend le « + » d'une petite case. */
const COMPACT_TILE_HEIGHT = 120;
/** La ligne du tampon d'une case d'édition. */
const KIND_LINE = 14;
/** La marge d'une case vide et son contour, en haut comme en bas. */
const EMPTY_INSET = 10 + border.ink;

/**
 * Ce qu'une case vide pose, selon la place qu'elle a. Les éditions de 4 et 5 cases
 * ont une dernière rangée de 95 points de haut, large mais basse, que le dossier
 * ne dessine pas : elle y prend le « + » et le libellé d'une petite case, et ses
 * écarts se resserrent pour que le plateau garde sa hauteur (D6). 2 points au
 * moins ; au-delà, le plateau grandit plutôt que de couper le libellé.
 */
export function emptyTileContent({
  tile,
  minHeight,
  question = false,
  fontScale,
}: {
  tile: TileSize;
  minHeight?: number;
  question?: boolean;
  fontScale: number;
}): { compact: boolean; plus: number; gap: number } {
  const compact = tile === 's' || (minHeight !== undefined && minHeight < COMPACT_TILE_HEIGHT);
  const plus = compact ? 30 : 36;
  if (minHeight === undefined) return { compact, plus, gap: 8 };
  const lines =
    tilePromptType(compact ? 's' : tile, fontScale).lineHeight + (question ? KIND_LINE : 0);
  const gaps = question ? 2 : 1;
  const room = (minHeight - 2 * EMPTY_INSET - plus - lines) / gaps;
  return { compact, plus, gap: Math.max(2, Math.min(8, room)) };
}

/**
 * La question d'une case d'édition remplie, dans sa puce (D2) : deux lignes au
 * plus, juste assez petite pour y tenir, sans laisser la pastille d'attente la
 * recouvrir. La même mesure que les autres rendus (`fitLabel`), dans la police
 * de la puce.
 */
export function tagQuestionFit({
  question,
  width,
  tile,
  density = 'compose',
  fontScale,
  pending = false,
  pixelRatio,
}: {
  question: string;
  width: number;
  tile: TileSize;
  density?: BentoDensity;
  fontScale: number;
  pending?: boolean;
  pixelRatio?: number;
}): LabelFit {
  const { tagInset, tagScale } = tileMeasures(tile, density);
  const type = tagType(fontScale);
  // La puce grandit par une échelle : sa largeur utile se compte avant elle.
  const usable =
    (width - 2 * tagInset - (pending ? PENDING_BADGE + PENDING_GAP : 0)) / tagScale -
    2 * TAG.paddingH;
  return fitLabel(question, usable, type.fontSize, {
    measure: (line, fontSize) => tagLabelWidth(line, fontSize, fontSize * TAG.em),
    minFontSize: QUESTION_MIN_FONT,
    maxLines: 2,
    pixelRatio,
  });
}

/** Les kana, idéogrammes et hangûl se coupent entre deux caractères : rien à mesurer. */
const BREAKS_ANYWHERE = /[぀-ヿ㐀-䶿一-鿿가-힯]/;
/** Une espace où la ligne peut se couper : les insécables n'en sont pas. */
const BREAKING_SPACE = /[^\S   ]+/;

/** Les morceaux qu'une ligne ne peut pas couper : les mots, et ce que sépare un trait d'union. */
export function unbreakableChunks(title: string): string[] {
  return title
    .trim()
    .split(BREAKING_SPACE)
    .flatMap((word) => word.split(/(?<=[-‐])/))
    .filter((chunk) => chunk.length > 0 && !BREAKS_ANYWHERE.test(chunk));
}

/** Retiré à la ligne avant de mesurer : un mot qui la remplirait exactement ne tient qu'au gré des arrondis. */
const ROUNDING_SLACK = 0.5;

/** Le plus petit titre, celui du bento miniature : `tile-s`, 11 sur les 15 d'une petite case. */
const TITLE_FLOOR = 11;
const SHARE_TITLE_FLOOR_RATIO = 11 / 15;

/**
 * La taille d'un titre dont aucun mot ne se coupe au milieu : juste assez petite
 * pour que le plus long tienne sur une ligne, jusqu'à celle du bento miniature.
 *
 * Mesuré le 5 novembre 2026 sur les 304 items validés : « Productions »,
 * « HugoDécrypte », « Montpellier », « Megalovania » dépassent d'une petite case
 * à l'iPhone 17 Pro, de 2 à 16 %, et tous tiennent au-dessus du plancher, à
 * l'iPhone SE compris. Sur Android, la taille tombe sur le pixel entier en
 * dessous : celui du dessus déborderait.
 */
export function tileTitleSize({
  title,
  textWidth,
  fontSize,
  letterSpacing,
  density = 'compose',
  pixelRatio,
}: {
  title: string;
  textWidth: number;
  fontSize: number;
  letterSpacing: number;
  density?: BentoDensity;
  pixelRatio?: number;
}): number {
  const widest = unbreakableChunks(title).reduce(
    (max, chunk) => Math.max(max, tileTitleWidth(chunk, fontSize, letterSpacing)),
    0,
  );
  const room = textWidth - ROUNDING_SLACK;
  if (widest <= room || widest === 0 || room <= 0) return fontSize;
  const floor = density === 'share' ? fontSize * SHARE_TITLE_FLOOR_RATIO : TITLE_FLOOR;
  const wanted = Math.max(floor, (fontSize * room) / widest);
  if (pixelRatio === undefined) return wanted;
  return (Math.floor(wanted * pixelRatio) - 0.01) / pixelRatio;
}

/**
 * Ce qui remet le titre d'une case à sa place, en part de sa taille. Une ligne
 * aussi haute que la police, ou presque, ne pose pas le texte au même endroit
 * sur iOS, sur Android et dans le navigateur de la maquette. Mesuré au pixel le 5
 * novembre 2026 contre `c07` : sur iOS, 2,67 points trop haut dans une grande
 * case et 1,1 dans une petite ; sur Android, 1,5 trop bas dans une moyenne.
 */
const TITLE_NUDGE: Record<'ios' | 'android', Record<TileSize, number>> = {
  ios: { xl: 0.095, l: 0, s: 0.08 },
  android: { xl: 0, l: -0.075, s: 0 },
};

export function tileTitleNudge(
  tile: TileSize,
  platform: 'ios' | 'android',
  fontSize: number,
): number {
  return TITLE_NUDGE[platform][tile] * fontSize;
}

/** L'écart entre la puce et le texte du bas. */
const TAG_CLEARANCE = 2;

export type TileFit = {
  /** La taille du titre, sa hauteur de ligne et son approche. */
  title: { fontSize: number; lineHeight: number; letterSpacing: number };
  /** Lignes au plus. */
  titleLines: number;
  subtitle: { fontSize: number; lineHeight: number; gap: number } | null;
  credit: { fontSize: number; lineHeight: number; gap: number } | null;
};

/**
 * Ce qu'une case remplie garde, pour que rien ne se chevauche (D7) : sur `c07` et
 * `u07`, un titre de trois lignes passe sous la puce. Le titre perd d'abord ses
 * lignes de trop, jusqu'à deux ; puis le sous-titre s'efface ; puis le titre
 * descend à une ligne. Le crédit reste toujours : la licence de l'image le
 * demande.
 */
export function tileTextFit({
  title,
  width,
  height,
  tile,
  density = 'compose',
  fontScale,
  hasSubtitle = false,
  hasCredit = false,
  tagHeight,
  pixelRatio,
}: {
  title: string;
  width: number;
  height: number;
  tile: TileSize;
  density?: BentoDensity;
  /** L'image partagée est figée à la police par défaut : 1. */
  fontScale: number;
  hasSubtitle?: boolean;
  hasCredit?: boolean;
  /** La hauteur de la puce, qui grandit pour porter une question. */
  tagHeight?: number;
  pixelRatio?: number;
}): TileFit {
  const measures = tileMeasures(tile, density);
  const base = scaled(measures.title, fontScale);
  const fontSize = tileTitleSize({
    title,
    textWidth: width - 2 * measures.padding,
    fontSize: base.fontSize,
    letterSpacing: base.letterSpacing,
    density,
    pixelRatio,
  });
  const ratio = fontSize / base.fontSize;
  const type = {
    fontSize,
    lineHeight: base.lineHeight * ratio,
    letterSpacing: Math.round(base.letterSpacing * ratio * 100) / 100,
  };
  const subtitleType = hasSubtitle ? scaled(measures.subtitle, fontScale) : null;
  const creditType = hasCredit ? scaled(measures.credit, fontScale) : null;
  const tagBox = (tagHeight ?? tagType(fontScale).height) * measures.tagScale;
  const room =
    height -
    measures.padding -
    (measures.tagInset + tagBox) -
    TAG_CLEARANCE -
    (creditType ? creditType.lineHeight + creditType.gap : 0);
  const subtitleRoom = subtitleType ? subtitleType.lineHeight + subtitleType.gap : 0;

  const linesIn = (space: number, atLeast: number) => {
    let lines = base.maxLines;
    while (lines > atLeast && lines * type.lineHeight > space) lines -= 1;
    return lines;
  };
  const withSubtitle = linesIn(room - subtitleRoom, 2);
  if (!subtitleType || withSubtitle * type.lineHeight <= room - subtitleRoom) {
    return { title: type, titleLines: withSubtitle, subtitle: subtitleType, credit: creditType };
  }
  return { title: type, titleLines: linesIn(room, 1), subtitle: null, credit: creditType };
}

/** Ce que lit le lecteur d'écran d'une case remplie, « Film : Inception, 2010 ». */
export function tileAccessibilityLabel({
  label,
  title,
  subtitle,
  pending = false,
}: {
  label: string;
  title: string;
  subtitle?: string;
  pending?: boolean;
}): string {
  return `${label} : ${title}${subtitle ? `, ${subtitle}` : ''}${pending ? ', en attente de validation' : ''}`;
}

/** L'initiale géante d'une case sans image : sa première lettre ou son premier chiffre. */
export function tileInitial(title: string): string {
  const match = title.trim().match(/[\p{L}\p{N}]/u);
  return (match?.[0] ?? '?').toLocaleUpperCase('fr');
}

/**
 * Les extrémités du dégradé qui estompe les pois d'une case, comme le
 * `linear-gradient(200deg, …)` du CSS dans une boîte de cette taille : opaque en
 * haut à droite, transparent à 60 % de sa longueur.
 */
export function dotsFadeLine(
  width: number,
  height: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const angle = (200 * Math.PI) / 180;
  const dx = Math.sin(angle);
  const dy = -Math.cos(angle);
  const half = (Math.abs(width * dx) + Math.abs(height * dy)) / 2;
  return {
    x1: width / 2 - dx * half,
    y1: height / 2 - dy * half,
    x2: width / 2 + dx * half,
    y2: height / 2 + dy * half,
  };
}
