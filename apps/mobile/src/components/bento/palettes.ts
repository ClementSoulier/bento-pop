/**
 * Palettes de fond pour les tiles du bento.
 *
 * Chaque palette = un dégradé linéaire (couleurs + angle), une couleur d'encre
 * (texte) et une accent. Réutilisable par catégorie ou choisie par l'item.
 *
 * Cf. design Claude Design — `PALETTES` dans `bento-tiles.jsx`.
 *
 * En prod, on superposera : image réelle (poster TMDb, cover MusicBrainz…)
 * en background + ce gradient comme overlay sombre pour la lisibilité du
 * titre, ou la palette seule si l'item n'a pas d'image (fallback texte libre).
 */

export type Palette = {
  /** Couleurs du gradient, du haut au bas. */
  colors: [string, string, ...string[]];
  /** Direction du gradient en couple { x, y } (0..1 chacun). */
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  /** Couleur du texte par-dessus la tile. */
  ink: string;
  /** Couleur d'accent (badges, séparateurs). */
  accent: string;
};

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
  /** Palette neutre par défaut (item sans visuel ni palette dédiée). */
  neutral: {
    colors: ['#fbf3de', '#f5e8c9'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    ink: '#0a0a0a',
    accent: '#0a0a0a',
  },
} as const satisfies Record<string, Palette>;

export type PaletteKey = keyof typeof PALETTES;
