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

// ─── Une case, telle qu'un rendu la voit ───────────────────────────────

/**
 * Ce qu'un dessin de la boîte doit savoir d'une case pour la tracer.
 *
 * **Le type qui remplace `CategoryKey` dans les rendus**, et c'est le cœur du
 * chantier 13. Les cinq dessins prenaient un dictionnaire indexé par
 * catégorie, `Partial<Record<CategoryKey, …>>`. Une édition n'a pas de
 * catégories : elle a des cases ordonnées, dont deux peuvent porter le même
 * type. Ce dictionnaire ne pouvait pas la représenter, et le type l'interdisait
 * littéralement, puisque `CategoryKey` est une union fermée de six littéraux.
 *
 * Les rendus prennent donc une **liste ordonnée**. Pour le bento principal,
 * `MAIN_CASES` la fabrique à partir des constantes de l'app, inchangées ; pour
 * une édition, elle vient de la base.
 */
export type CaseMeta = {
  /** Identifiant stable : clé de catégorie, ou clé de case d'édition. */
  readonly key: string;
  /** Ce que lit l'utilisateur sur une case vide. Pour une édition, la question. */
  readonly prompt: string;
  /** Tampon court de la tuile pleine, capitales. */
  readonly stamp: string;
  /** Genre grammatical de `prompt`, pour accorder « Cherche un film ». */
  readonly gender: 'm' | 'f';
};

/**
 * Les six cases du bento principal, dans l'ordre de lecture.
 *
 * Dérivées des constantes que l'app compile depuis toujours : aucune version
 * déployée ne change d'affichage. La base porte les mêmes valeurs depuis le
 * chantier 13, et `bento-cases-vs-app.test.ts` échoue si les deux divergent.
 */
export const MAIN_CASES: readonly CaseMeta[] = CATEGORY_ORDER.map((key) => ({
  key,
  prompt: CATEGORY_META[key].label,
  stamp: CATEGORY_META[key].stamp,
  gender: CATEGORY_META[key].gender,
}));

// ─── Dispositions de la boîte ──────────────────────────────────────────

/**
 * Comment la boîte se découpe, de 2 à 6 cases.
 *
 * **Une seule table, lue par les cinq dessins de la boîte** : la grille de
 * l'app, son squelette de chargement, la grille web, l'aperçu de lien
 * 1200×630 et l'image de partage 1080×1920. Avant le chantier 13, chacun
 * portait ses propres nombres, écrits à la main : c'est ainsi que l'aperçu
 * de lien a dessiné pendant des mois des rangées de 160 points au lieu de
 * 233 / 142 / 106, sans que rien ne le signale.
 *
 * **Dessinées par Rob, validées le 16 septembre 2026.** Deux règles les
 * tiennent, et elles se lisent dans les nombres :
 *
 * - **le compartiment vedette reste** : toute disposition ouvre sur une
 *   rangée d'une seule case, parce que c'est ce qui fait lire une boîte
 *   bento plutôt qu'une grille ;
 * - **une rangée de trois cases n'apparaît qu'à six**. Mesuré à la police
 *   réelle : une case de rangée à trois offre 80 points utiles, et un
 *   intitulé tient sur deux lignes sans réduction, donc « Le film qui t'a
 *   fait pleurer » y demanderait trois lignes. Les éditions portent des
 *   questions, pas des mots courts.
 *
 * De 4 à 6 cases, les hauteurs ne changent pas : 220 / 134 / 100, celles de
 * l'existant. Seule la dernière rangée se divise autrement. Les cinq rendus
 * gardent donc exactement les nombres qu'ils avaient pour le bento
 * principal, ce qui est la raison de ce découpage.
 */

/** Gabarit d'une case, déduit du nombre de cases de sa rangée. */
export type TileSize = 'lg' | 'md' | 'sm';

export type BoxRow = {
  /** 1, 2 ou 3. Au-delà, une case ne saurait plus porter de texte. */
  readonly cases: 1 | 2 | 3;
  /** Hauteur de la rangée à l'échelle 1, en points. */
  readonly height: number;
};

/** Largeur intérieure du cadre, à l'échelle 1 : 361 moins cadre et marge. */
export const BOX_INNER_WIDTH = 323;

/** Hauteur intérieure du cadre, à l'échelle 1 : 512 moins cadre et marge. */
export const BOX_INNER_HEIGHT = 474;

/** Écart entre rangées, et entre cases d'une même rangée. */
export const BOX_GAP = 10;

/**
 * Colonnes de la grille web. 6 est le plus petit commun multiple de 1, 2 et
 * 3 : une case couvre 6, 3 ou 2 colonnes, ce qui reproduit exactement les
 * largeurs d'une disposition en rangées tout en gardant une liste plate dans
 * le DOM.
 */
export const BOX_COLUMNS = 6;

export const BOX_LAYOUTS: Readonly<Record<number, readonly BoxRow[]>> = {
  2: [
    { cases: 1, height: 280 },
    { cases: 1, height: 184 },
  ],
  3: [
    { cases: 1, height: 220 },
    { cases: 2, height: 244 },
  ],
  4: [
    { cases: 1, height: 220 },
    { cases: 2, height: 134 },
    { cases: 1, height: 100 },
  ],
  5: [
    { cases: 1, height: 220 },
    { cases: 2, height: 134 },
    { cases: 2, height: 100 },
  ],
  6: [
    { cases: 1, height: 220 },
    { cases: 2, height: 134 },
    { cases: 3, height: 100 },
  ],
};

/**
 * Micro-rotations par position, dans l'ordre de lecture.
 *
 * L'ordre est significatif : les six premières valeurs sont **exactement**
 * celles que le bento principal portait avant le chantier 13, écrites une à
 * une dans le JSX. Les changer ferait bouger la boîte de tout le monde.
 * Une case vide en applique la moitié, comme avant.
 */
export const BOX_ROTATIONS: readonly number[] = [-0.5, 0.4, -0.3, -0.3, 0.5, -0.2];

/** Où une case se pose dans la boîte, tout ce dont un rendu a besoin. */
export type TilePlacement = {
  /** Rang dans l'ordre de lecture, à partir de 0. */
  readonly index: number;
  /** Rangée, à partir de 1. */
  readonly row: number;
  /** Nombre de cases de cette rangée. */
  readonly casesInRow: 1 | 2 | 3;
  /** Hauteur de la rangée, à l'échelle 1. */
  readonly height: number;
  readonly size: TileSize;
  /** Colonnes couvertes dans la grille web. */
  readonly span: number;
  readonly rotate: number;
};

const SIZE_BY_ROW: Readonly<Record<1 | 2 | 3, TileSize>> = { 1: 'lg', 2: 'md', 3: 'sm' };

/**
 * La disposition d'une boîte de `count` cases, à plat.
 *
 * Rend un tableau vide pour un nombre hors des dispositions dessinées, plutôt
 * que de lever : un rendu qui reçoit une édition d'un nombre inconnu doit
 * dégrader, pas planter. Les appelants traitent déjà le cas vide, puisqu'une
 * case de catégorie inconnue était déjà sautée.
 */
export function boxPlacements(count: number): readonly TilePlacement[] {
  const rows = BOX_LAYOUTS[count];
  if (!rows) return [];

  const placements: TilePlacement[] = [];
  let index = 0;
  rows.forEach((row, r) => {
    for (let i = 0; i < row.cases; i += 1) {
      placements.push({
        index,
        row: r + 1,
        casesInRow: row.cases,
        height: row.height,
        size: SIZE_BY_ROW[row.cases],
        span: BOX_COLUMNS / row.cases,
        rotate: BOX_ROTATIONS[index % BOX_ROTATIONS.length] ?? 0,
      });
      index += 1;
    }
  });
  return placements;
}

/** Hauteurs de rangée d'une disposition, dans l'ordre. */
export function boxRowHeights(count: number): readonly number[] {
  return (BOX_LAYOUTS[count] ?? []).map((row) => row.height);
}

/**
 * Largeur d'une case à l'échelle 1, selon le nombre de cases de sa rangée :
 * 323, 156,5 ou 101.
 */
export function boxTileWidth(casesInRow: number): number {
  return (BOX_INNER_WIDTH - BOX_GAP * (casesInRow - 1)) / casesInRow;
}

/**
 * Largeur utile pour du texte dans une case, à l'échelle 1 : la case moins
 * son cadre de 2,5 et sa marge de 8, des deux côtés. Vaut 302, 135,5 ou 80.
 *
 * C'est le nombre qui décide si un intitulé d'édition tient, et c'est
 * pourquoi il vit ici plutôt que dans l'app : le back-office doit appliquer
 * la même règle avant d'enregistrer une case.
 */
export function boxTileTextWidth(casesInRow: number): number {
  return boxTileWidth(casesInRow) - 8 * 2 - 2.5 * 2;
}

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
