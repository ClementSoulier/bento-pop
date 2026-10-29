import content from '@bento-pop/brand/assets/mascot/popy-content.png';
import diable from '@bento-pop/brand/assets/mascot/popy-diable.png';
import enerve from '@bento-pop/brand/assets/mascot/popy-enerve.png';
import fille from '@bento-pop/brand/assets/mascot/popy-fille.png';
import gene from '@bento-pop/brand/assets/mascot/popy-gene.png';
import intelloEnerve from '@bento-pop/brand/assets/mascot/popy-intello-enerve.png';
import intello from '@bento-pop/brand/assets/mascot/popy-intello.png';
import malade from '@bento-pop/brand/assets/mascot/popy-malade.png';
import nani from '@bento-pop/brand/assets/mascot/popy-nani.png';
import { POPY_CROPS, type PopyCrop, type PopyFile } from './popy-crops';

/**
 * Les humeurs de Popy (chantier 30), sous les noms du design et de ses
 * fichiers : `bisou` est le fichier `fille`, `surpris` le fichier `nani`. Les
 * images sont celles de `packages/brand`, dont l'original de `popy-diable`
 * (D15), et non les copies du dossier de la refonte.
 */
export type Mood =
  | 'content'
  | 'bisou'
  | 'fille'
  | 'intello'
  | 'gene'
  | 'surpris'
  | 'nani'
  | 'enerve'
  | 'intello-enerve'
  | 'malade'
  | 'diable';

const FILES: Record<Mood, PopyFile> = {
  content: 'content',
  bisou: 'fille',
  fille: 'fille',
  intello: 'intello',
  gene: 'gene',
  surpris: 'nani',
  nani: 'nani',
  enerve: 'enerve',
  'intello-enerve': 'intello-enerve',
  malade: 'malade',
  diable: 'diable',
};

const SOURCES: Record<PopyFile, number> = {
  content,
  diable,
  enerve,
  fille,
  gene,
  'intello-enerve': intelloEnerve,
  intello,
  malade,
  nani,
};

export function popyImage(mood: Mood): number {
  return SOURCES[FILES[mood]];
}

/** Le carré du dessin dans l'original, cf. `popy-crops.ts`. */
export function popyCrop(mood: Mood): PopyCrop {
  return POPY_CROPS[FILES[mood]];
}
