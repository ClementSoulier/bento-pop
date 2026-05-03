import type { StaticImageData } from 'next/image';
import popyContent from '@bento-pop/brand/assets/mascot/popy-content.png';
import popyDiable from '@bento-pop/brand/assets/mascot/popy-diable.png';
import popyEnerve from '@bento-pop/brand/assets/mascot/popy-enerve.png';
import popyFille from '@bento-pop/brand/assets/mascot/popy-fille.png';
import popyGene from '@bento-pop/brand/assets/mascot/popy-gene.png';
import popyIntello from '@bento-pop/brand/assets/mascot/popy-intello.png';
import popyIntelloEnerve from '@bento-pop/brand/assets/mascot/popy-intello-enerve.png';
import popyMalade from '@bento-pop/brand/assets/mascot/popy-malade.png';
import popyNani from '@bento-pop/brand/assets/mascot/popy-nani.png';

export type Popy = {
  key: PopyKey;
  img: StaticImageData;
  name: string;
  /** Tint Tailwind appliqué au compartiment quand ce Popy est servi. */
  tint: 'tint-a' | 'tint-b' | 'tint-c' | 'tint-d';
  /** Jeu placeholder — à brancher sur la base de jeux Supabase plus tard. */
  game: { name: string; desc: string };
};

export type PopyKey =
  | 'content'
  | 'diable'
  | 'enerve'
  | 'fille'
  | 'gene'
  | 'intello'
  | 'intelloEnerve'
  | 'malade'
  | 'nani';

export const POPYS: Record<PopyKey, Popy> = {
  content: {
    key: 'content',
    img: popyContent,
    name: 'Popy Content',
    tint: 'tint-a',
    game: { name: 'Liste', desc: 'Prêt à lister ?' },
  },
  diable: {
    key: 'diable',
    img: popyDiable,
    name: 'Popy Diable',
    tint: 'tint-d',
    game: { name: 'Duel', desc: '1v1 contre notre animateur !' },
  },
  enerve: {
    key: 'enerve',
    img: popyEnerve,
    name: 'Popy Énervé',
    tint: 'tint-b',
    game: { name: 'C\'est toi qui choisi !', desc: 'À toi de choisir le défi que tu préfères.' },
  },
  fille: {
    key: 'fille',
    img: popyFille,
    name: 'Popy Fille',
    tint: 'tint-a',
    game: { name: 'Les mots', desc: 'Un mot où une expression à définir !' },
  },
  gene: {
    key: 'gene',
    img: popyGene,
    name: 'Popy Gêné',
    tint: 'tint-c',
    game: { name: 'Fais-nous rire / Anecdotes', desc: '30 secondes pour nous faire rire, où une super anecdotes à raconter' },
  },
  intello: {
    key: 'intello',
    img: popyIntello,
    name: 'Popy Intello',
    tint: 'tint-c',
    game: { name: 'Quiz', desc: 'C\'est parti pour les questions' },
  },
  intelloEnerve: {
    key: 'intelloEnerve',
    img: popyIntelloEnerve,
    name: 'Popy Savant',
    tint: 'tint-b',
    game: { name: 'Quiz images', desc: 'C\'est parti pour les questions' },
  },
  malade: {
    key: 'malade',
    img: popyMalade,
    name: 'Popy Malade',
    tint: 'tint-d',
    game: { name: 'C\'est nous', desc: 'C\'est les animateurs qui décident' },
  },
  nani: {
    key: 'nani',
    img: popyNani,
    name: 'Popy Nani',
    tint: 'tint-a',
    game: { name: 'Je pense à ...', desc: 'Devine à quoi je pense !' },
  },
};
