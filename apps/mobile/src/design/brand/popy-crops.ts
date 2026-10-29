/**
 * Le cadrage du dessin de Popy dans chaque original de `packages/brand`
 * (chantier 30, lot 4).
 *
 * Le dossier de la refonte dessine Popy depuis des découpes de 320 px où le
 * dessin touche les bords : un carré du côté de sa plus grande dimension,
 * centré sur lui. Les originaux font 1 000 px et gardent de 5 à 10 % de
 * marge transparente : posée à 120, Popy n'y mesurait que 97 de large, et
 * l'avatar et l'icône de l'app, qui en prennent 86 et 84 %, rétrécissaient
 * d'autant. Relevé au lot 4, manqué au lot 3.
 *
 * Refait depuis les originaux, ce carré coïncide au pixel avec les découpes
 * du dossier (IoU de 1,000 sur les huit), sauf `diable`, dont le dossier n'a
 * qu'une découpe provisoire (D15). En pixels de l'original : le coin haut
 * gauche du carré et son côté ; `popy-crops.test.ts` les recalcule depuis
 * les PNG.
 *
 * Aucun import de `react-native` : testé sous `node:test`.
 */

/** Le côté des originaux, en pixels. */
export const POPY_SOURCE_SIDE = 1000;

/** Les fichiers de `packages/brand/assets/mascot/`, sans `popy-` ni `.png`. */
export type PopyFile =
  | 'content'
  | 'diable'
  | 'enerve'
  | 'fille'
  | 'gene'
  | 'intello-enerve'
  | 'intello'
  | 'malade'
  | 'nani';

export type PopyCrop = { x: number; y: number; side: number };

export const POPY_CROPS: Record<PopyFile, PopyCrop> = {
  content: { x: 97, y: 97, side: 806 },
  diable: { x: 45, y: 52.5, side: 913 },
  enerve: { x: 79, y: 79, side: 842 },
  fille: { x: 95, y: 105.5, side: 826 },
  gene: { x: 51, y: 70, side: 898 },
  'intello-enerve': { x: 79, y: 67, side: 874 },
  intello: { x: 66, y: 66, side: 868 },
  malade: { x: 44, y: 55, side: 912 },
  nani: { x: 83.5, y: 39, side: 842 },
};
