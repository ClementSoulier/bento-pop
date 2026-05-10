import type { UniversContent } from '@/lib/content/schemas';
import popyContent from '@bento-pop/brand/assets/mascot/popy-content.png';
import popyDiable from '@bento-pop/brand/assets/mascot/popy-diable.png';
import popyNani from '@bento-pop/brand/assets/mascot/popy-nani.png';
import popyIntello from '@bento-pop/brand/assets/mascot/popy-intello.png';

/**
 * Mapping mascotte ↔ univers — choisi pour le caractère de chaque Popy :
 *  - Cinéma → Popy Content (l'air enthousiaste, devant l'écran)
 *  - Gaming → Popy Diable (le côté mischievous / compétitif)
 *  - Japon · Corée → Popy Nani (le « nani?! » en référence directe)
 *  - Société → Popy Intello (lunettes, posture débat)
 */
export async function getUnivers(): Promise<UniversContent> {
  return {
    eyebrow: 'Les Univers du Bento',
    title: 'Le plein de saveur \nsur un seul plateau',
    description:
      "Comme pour un vrai bento, chaque sujet se complète, s'enrichi alimente nos discussions passionnées !",
    items: [
      {
        id: 'cinema',
        tone: 'cinema',
        mascotPath: popyContent.src,
        title: 'Cinéma',
        description:
          'Des blockbusters aux pépites indépendantes, on dissèque aussi bien les sorties qui font vibrer les salles que les grands classiques qui font couler des larmes.',
        tags: ['Blockbusters', 'Cinéma', 'Auteurs', 'Sorties'],
        order: 1,
      },
      {
        id: 'gaming',
        tone: 'gaming',
        mascotPath: popyDiable.src,
        title: 'Gaming',
        description:
          "L'actualité et la nostalgie, du triple A à la pépite à découvrir, on parle de tous les jeux, pour tous les goûts.",
        tags: ['AAA', 'Indé', 'RetroGaming', 'Live'],
        order: 2,
      },
      {
        id: 'japan',
        tone: 'japan',
        mascotPath: popyNani.src,
        title: 'Japon · Corée',
        description:
          "L'essence du manga, du Webtoon et de l'animation. Ce qui se passe à Tokyo, à Séoul, on en parle ici.",
        tags: ['Manga', 'Anime', 'Webtoon', 'K-culture'],
        order: 3,
      },
      {
        id: 'societe',
        tone: 'societe',
        mascotPath: popyIntello.src,
        title: 'Société',
        description:
          'Décryptage des réseaux sociaux, de la santé mentale et des sujets qui nous touchent de plus de plus.',
        tags: ['Réseaux', 'Santé mentale', 'Débats'],
        order: 4,
      },
    ],
  };
}
