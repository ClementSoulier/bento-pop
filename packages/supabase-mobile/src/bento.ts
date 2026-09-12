import type { CategoryKey } from './types';

/**
 * Domaine bento partagé — constantes indépendantes de la plateforme.
 *
 * Ce module est consommé par `apps/mobile` (React Native), `apps/admin`
 * (BO) et `apps/landing` (page publique `/u/[pseudo]` et son image Open
 * Graph). Il ne contient **que** des données et des fonctions pures : pas
 * d'import d'asset, pas de `react-native`, pas de `next`. Chaque app mappe
 * ensuite ces clés vers ses propres composants et ses propres fichiers
 * d'images.
 *
 * Pourquoi ici plutôt que dupliqué par app : l'apparence d'un même bento
 * doit être identique dans l'app, sur la page web et dans l'image de
 * partage. Une divergence de palette ou d'ordre de catégories se voit
 * immédiatement et passe pour un bug.
 */

// ─── Catégories ────────────────────────────────────────────────────────

/**
 * Correspondance clé → `bento_categories.id`.
 * Doit rester alignée avec le seed de la migration
 * `20260511000000_initial_schema.sql`.
 */
export const CATEGORY_IDS: Readonly<Record<CategoryKey, number>> = {
  film: 1,
  series: 2,
  artist: 3,
  track: 4,
  creator: 5,
  place: 6,
};

/**
 * Correspondance inverse. Volontairement typée avec `| undefined` : une
 * 7e catégorie peut être ajoutée en base avant que les clients ne soient
 * déployés, et l'appelant doit gérer ce cas plutôt que de faire confiance
 * à un `Record` total.
 */
export const CATEGORY_BY_ID: Readonly<Record<number, CategoryKey | undefined>> =
  Object.fromEntries(
    Object.entries(CATEGORY_IDS).map(([key, id]) => [id, key as CategoryKey]),
  );

/** Ordre d'affichage canonique, du grand compartiment au plus petit. */
export const CATEGORY_ORDER: readonly CategoryKey[] = [
  'film',
  'series',
  'artist',
  'track',
  'creator',
  'place',
];

/**
 * Libellés FR et tampons tout-caps affichés sur les tuiles.
 *
 * `gender` porte le genre grammatical du libellé. Il existe parce que toute
 * phrase construite autour du libellé doit s'accorder : sans lui, la modale
 * de recherche affichait « Cherche un chanson… » et « Cherche un série… ».
 * Le genre est une propriété du mot, pas de l'écran qui l'emploie, donc il
 * vit ici avec le libellé et non recopié chez chaque appelant.
 */
export const CATEGORY_META: Readonly<
  Record<
    CategoryKey,
    { readonly label: string; readonly stamp: string; readonly gender: 'm' | 'f' }
  >
> = {
  film: { label: 'Film', stamp: 'FILM', gender: 'm' },
  series: { label: 'Série', stamp: 'SÉRIE', gender: 'f' },
  artist: { label: 'Artiste', stamp: 'ARTISTE', gender: 'm' },
  track: { label: 'Chanson', stamp: 'SON', gender: 'f' },
  creator: { label: 'Créateur de contenu', stamp: 'CRÉA', gender: 'm' },
  place: { label: 'Lieu', stamp: 'LIEU', gender: 'm' },
};

// ─── Hash stable ───────────────────────────────────────────────────────

/**
 * djb2. Déterministe, stable entre plateformes et entre versions de Node,
 * suffisant pour distribuer quelques dizaines de valeurs.
 *
 * Le `| 0` force l'arithmétique 32 bits signée à chaque tour, sinon le
 * cumul dépasse `Number.MAX_SAFE_INTEGER` et le résultat dériverait selon
 * la précision flottante.
 */
export function stableHash(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// ─── Palettes ──────────────────────────────────────────────────────────

export type Palette = {
  /** Couleurs du dégradé, de la première à la dernière étape. */
  readonly colors: readonly [string, string, ...string[]];
  /** Origine du dégradé, en coordonnées normalisées (0..1). */
  readonly start: { readonly x: number; readonly y: number };
  /** Fin du dégradé, en coordonnées normalisées (0..1). */
  readonly end: { readonly x: number; readonly y: number };
  /** Couleur du texte posé sur la tuile. */
  readonly ink: string;
  /** Couleur d'accent (badges, séparateurs). */
  readonly accent: string;
};

/**
 * Dégradés de repli, utilisés quand un item n'a pas d'illustration.
 *
 * `neutral` est le repli explicite et n'entre jamais dans la rotation
 * décorative (cf. `DECORATIVE_PALETTE_KEYS`).
 */
export const PALETTES = {
  duneSand: {
    colors: ['#c89968', '#8b5e34', '#4a2f1a'],
    start: { x: 0.2, y: 0 },
    end: { x: 0.8, y: 1 },
    ink: '#ffffff',
    accent: '#ffd599',
  },
  severance: {
    colors: ['#e8eef3', '#b8c5d1', '#4a5a6e'],
    start: { x: 0.5, y: 0 },
    end: { x: 0.5, y: 1 },
    ink: '#0a1a2e',
    accent: '#5a8fb8',
  },
  charliBrat: {
    colors: ['#c4f542', '#8fd61c', '#5a8d10'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    ink: '#0a0a0a',
    accent: '#0a0a0a',
  },
  espresso: {
    colors: ['#f5d090', '#d49855', '#8b5a2b'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    ink: '#ffffff',
    accent: '#3a1f08',
  },
  squeezie: {
    colors: ['#4b3d8f', '#2a1f5c'],
    start: { x: 0.2, y: 0 },
    end: { x: 0.8, y: 1 },
    ink: '#ffffff',
    accent: '#ff4477',
  },
  tokyo: {
    colors: ['#ff5577', '#ff8855', '#ffcc88'],
    start: { x: 0.5, y: 0 },
    end: { x: 0.5, y: 1 },
    ink: '#ffffff',
    accent: '#ffffff',
  },
  shogun: {
    colors: ['#1a2530', '#3a1e1e', '#d4202c'],
    start: { x: 0.5, y: 0 },
    end: { x: 0.5, y: 1 },
    ink: '#ffffff',
    accent: '#d4a85a',
  },
  fallout: {
    colors: ['#c9b270', '#7a6438', '#2a1e10'],
    start: { x: 0.2, y: 0 },
    end: { x: 0.8, y: 1 },
    ink: '#0a0a0a',
    accent: '#3eef74',
  },
  weeknd: {
    colors: ['#1a0510', '#5a0a20', '#d4202c'],
    start: { x: 0.5, y: 0 },
    end: { x: 0.5, y: 1 },
    ink: '#ffffff',
    accent: '#ffffff',
  },
  seoul: {
    colors: ['#ff88aa', '#ffaadd', '#aaccff'],
    start: { x: 0.5, y: 0 },
    end: { x: 0.5, y: 1 },
    ink: '#0a0a0a',
    accent: '#0a0a0a',
  },
  /** Repli neutre : item sans visuel et sans palette attribuée. */
  neutral: {
    colors: ['#fbf3de', '#f5e8c9'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    ink: '#0a0a0a',
    accent: '#0a0a0a',
  },
} as const satisfies Record<string, Palette>;

export type PaletteKey = keyof typeof PALETTES;

/** Palettes entrant dans la rotation décorative, `neutral` exclue. */
export const DECORATIVE_PALETTE_KEYS: readonly PaletteKey[] = (
  Object.keys(PALETTES) as PaletteKey[]
).filter((key) => key !== 'neutral');

/**
 * Palette d'un item, dérivée de son identifiant.
 *
 * ⚠️ Historiquement, l'app dérivait la palette de **l'index de ligne** du
 * résultat Supabase (`PALETTE_KEYS[idx % ...]`). PostgreSQL ne garantit
 * aucun ordre sans `ORDER BY` : le même bento pouvait donc changer de
 * couleurs d'un chargement à l'autre, et n'avait aucune raison d'être
 * identique entre l'app, la page web et l'image de partage.
 *
 * Le hash de l'identifiant supprime le problème : même item, même palette,
 * partout et pour toujours.
 */
export function paletteKeyForItem(itemId: string): PaletteKey {
  const keys = DECORATIVE_PALETTE_KEYS;
  return keys[stableHash(itemId) % keys.length] ?? 'neutral';
}

// ─── Avatars Popy ──────────────────────────────────────────────────────

/**
 * Variantes de mascotte, dans l'ordre attendu par `popyKeyForPseudo`.
 * L'ordre est significatif : le changer réattribuerait un autre Popy à
 * chaque utilisateur existant.
 */
export const POPY_KEYS = [
  'content',
  'intello',
  'fille',
  'gene',
  'nani',
  'diable',
] as const;

export type PopyKey = (typeof POPY_KEYS)[number];

/**
 * Avatar déterministe par pseudo, insensible à la casse. Évite une colonne
 * dédiée en base tant que le choix manuel n'existe pas. Chaque app mappe
 * ensuite la clé vers son propre fichier d'image.
 */
export function popyKeyForPseudo(pseudo: string): PopyKey {
  return POPY_KEYS[stableHash(pseudo.toLowerCase()) % POPY_KEYS.length] ?? 'content';
}
