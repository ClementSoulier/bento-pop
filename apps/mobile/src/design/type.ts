/**
 * Les 22 styles de texte du design system v2, et ce que la taille du système
 * leur permet (chantier 30, D1 et D8, `docs/UX-30-SOCLE-DESIGN-SYSTEM.md`
 * §4.3).
 *
 * Aucun import de `react-native` : les tests lisent ce module sous
 * `node:test`.
 */
import {
  ACTION_MAX_FONT_MULTIPLIER,
  FIXED_MAX_FONT_MULTIPLIER,
  READING_MAX_FONT_MULTIPLIER,
  scaledType,
} from '@/components/bento/font-scaling';
import { type as TYPE } from './tokens';

export type TextVariant = keyof typeof TYPE;

/**
 * Lecture et action grandissent jusqu'à 200 % ; le fixe s'arrête à 130 %, posé
 * dans une hauteur qu'il ne décide pas : la case, le moment de marque, la barre
 * d'onglets.
 */
export type TextCategory = 'lecture' | 'action' | 'fixe';

export function categoryOf(variant: TextVariant): TextCategory {
  const { family } = TYPE[variant];
  if (family === 'display' || family === 'tile' || variant === 'tab-label') return 'fixe';
  if (variant.startsWith('label-')) return 'action';
  return 'lecture';
}

export const CATEGORY_MAX_FONT_MULTIPLIER: Record<TextCategory, number> = {
  lecture: READING_MAX_FONT_MULTIPLIER,
  action: ACTION_MAX_FONT_MULTIPLIER,
  fixe: FIXED_MAX_FONT_MULTIPLIER,
};

/** Dès 130 %, un bouton passe à la ligne plutôt que de couper son libellé. */
export const WRAP_FONT_SCALE = 1.3;

/**
 * Le texte du système atteint-il 130 % ? Android donne sa taille en flottant
 * simple : son 1,3 arrive en 1,2999999523, qu'une comparaison exacte laissait
 * sous le seuil, relevé au Pixel 8 au lot 4. On compare au centième.
 */
export function reachesWrapScale(fontScale: number): boolean {
  return Math.round(fontScale * 100) >= Math.round(WRAP_FONT_SCALE * 100);
}

/**
 * La part de sa taille que garde une affiche dont le mot le plus long, mesuré
 * à la taille du style, ne tiendrait pas dans sa largeur (D24) : juste assez
 * pour qu'il tienne, au millième en dessous, jamais plus que sa taille.
 */
export function displayFit(width: number, widest: number): number {
  if (width <= 0 || widest <= width) return 1;
  return Math.floor(((width - 1) / widest) * 1000) / 1000;
}

/**
 * La police de chaque rôle, une famille par graisse : Android ne choisit pas
 * une graisse dans une famille chargée à la main (D7). `undefined` : la police
 * du système, qui prend sa graisse.
 */
function fontFamilyOf(family: string, weight: number): string | undefined {
  switch (family) {
    case 'display':
      return 'Extenda';
    case 'tile':
      return 'FredokaSemiCondensed-Bold';
    case 'heading':
      if (weight >= 700) return 'Fredoka-Bold';
      return weight >= 600 ? 'Fredoka-SemiBold' : 'Fredoka-Medium';
    default:
      return undefined;
  }
}

export type DesignTextStyle = {
  fontFamily?: string;
  fontWeight?: '400' | '500' | '600' | '700';
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
  textTransform?: 'uppercase';
};

/** Une graisse que le design donne à un style le temps d'un état : l'onglet courant, un compteur. */
export type TextWeight = 400 | 500 | 600 | 700;

/**
 * Le style d'un texte du système à la taille `fontScale` du système, plafonnée
 * selon sa catégorie : taille, hauteur de ligne et approche grandissent du même
 * facteur, cf. `scaledType`. `weight` remplace la graisse du style, jamais sa
 * taille.
 */
export function textStyle(
  variant: TextVariant,
  fontScale: number,
  weight?: TextWeight,
): DesignTextStyle {
  const style: (typeof TYPE)[TextVariant] = TYPE[variant];
  const cap = CATEGORY_MAX_FONT_MULTIPLIER[categoryOf(variant)];
  const { fontSize, lineHeight } = scaledType(fontScale, cap, style.fontSize, style.lineHeight);
  const result: DesignTextStyle = { fontSize, lineHeight };
  const fontWeight = weight ?? style.fontWeight;
  const fontFamily = fontFamilyOf(style.family, fontWeight);
  if (fontFamily) result.fontFamily = fontFamily;
  else result.fontWeight = String(fontWeight) as DesignTextStyle['fontWeight'];
  if ('letterSpacing' in style) {
    result.letterSpacing =
      Math.round(style.letterSpacing * (fontSize / style.fontSize) * 100) / 100;
  }
  if ('textTransform' in style) result.textTransform = style.textTransform;
  return result;
}
