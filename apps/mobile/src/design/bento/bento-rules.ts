/**
 * Les mesures du bento vide (chantier 31, D3), celles de `bundle.css` en
 * densité `compose`. Aucun import de `react-native` : les tests lisent ce
 * module sous `node:test`.
 */
import { CATEGORY_META } from '@bento-pop/supabase-mobile/bento';
import { FIXED_MAX_FONT_MULTIPLIER, scaledType } from '@/components/bento/font-scaling';
import type { CategoryKey } from '@/supabase/types';
import { border, size } from '../tokens';

export type TileSize = 'xl' | 'l' | 's';

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

/**
 * La hauteur de chaque rangée pour un plateau de cette largeur. C'est un
 * minimum, comme `aspect-ratio` en CSS : une case grandit plutôt que de couper
 * son libellé quand le texte du système monte.
 */
export function tileMinHeights(plateWidth: number): Record<TileSize, number> {
  const inner = plateWidth - 2 * (border.ink + size['plate-padding']);
  const gap = size['plate-gap'];
  return {
    xl: inner / TILE_RATIO.xl,
    l: (inner - gap) / 2 / TILE_RATIO.l,
    s: (inner - 2 * gap) / 3 / TILE_RATIO.s,
  };
}

/** La hauteur d'un plateau de cette largeur, ses trois rangées posées. */
export function plateMinHeight(plateWidth: number): number {
  const { xl, l, s } = tileMinHeights(plateWidth);
  return xl + l + s + 2 * size['plate-gap'] + 2 * (border.ink + size['plate-padding']);
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
 * Le libellé d'une case, 14/17, 12/14 dans une petite : deux styles que le
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
