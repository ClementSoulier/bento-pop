/**
 * Chemins typés vers les assets Bento Pop.
 *
 * Ces constantes désignent les fichiers du dossier `packages/brand/assets/`.
 * Côté app Next.js, on importe les fichiers eux-mêmes via :
 *
 *   import popyContent from '@bento-pop/brand/assets/mascot/popy-content.png';
 *
 * Le subpath export `"./assets/*"` du `package.json` autorise cet usage.
 * Les chemins ci-dessous servent de catalogue documenté.
 */

export const ASSET_BASE = '@bento-pop/brand/assets' as const;

export const mascotPaths = {
  content: 'mascot/popy-content.png',
  diable: 'mascot/popy-diable.png',
  enerve: 'mascot/popy-enerve.png',
  fille: 'mascot/popy-fille.png',
  gene: 'mascot/popy-gene.png',
  intello: 'mascot/popy-intello.png',
  intelloEnerve: 'mascot/popy-intello-enerve.png',
  malade: 'mascot/popy-malade.png',
  nani: 'mascot/popy-nani.png',
} as const;

export type MascotKey = keyof typeof mascotPaths;
export const mascotKeys = Object.keys(mascotPaths) as MascotKey[];

export const logoPaths = {
  bentoPop: 'logo/bento-pop.png',
} as const;

export const texturePaths = {
  fond: 'textures/fond.jpg',
} as const;

export const fontPaths = {
  extendaYotta: 'fonts/extenda-100-yotta.otf',
} as const;
