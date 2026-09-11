import type { StaticImageData } from 'next/image';
import popyContent from '@bento-pop/brand/assets/mascot/popy-content.png';
import popyDiable from '@bento-pop/brand/assets/mascot/popy-diable.png';
import popyFille from '@bento-pop/brand/assets/mascot/popy-fille.png';
import popyGene from '@bento-pop/brand/assets/mascot/popy-gene.png';
import popyIntello from '@bento-pop/brand/assets/mascot/popy-intello.png';
import popyNani from '@bento-pop/brand/assets/mascot/popy-nani.png';
import { popyKeyForPseudo, type PopyKey } from '@bento-pop/supabase-mobile/bento';

/**
 * Correspondance clé Popy → asset web.
 *
 * La *sélection* vit dans `@bento-pop/supabase-mobile/bento`, partagée avec
 * l'app : un même pseudo doit afficher le même Popy des deux côtés. Seul le
 * mapping vers le fichier est propre à chaque plateforme, l'app passant par
 * le bundler Metro et le web par `next/image`.
 *
 * Ce module est volontairement séparé des fonctions pures : il importe des
 * PNG, donc il n'est pas chargeable par le runner de tests.
 */
const POPY_IMAGES: Readonly<Record<PopyKey, StaticImageData>> = {
  content: popyContent,
  intello: popyIntello,
  fille: popyFille,
  gene: popyGene,
  nani: popyNani,
  diable: popyDiable,
};

export function popyForPseudo(pseudo: string): StaticImageData {
  return POPY_IMAGES[popyKeyForPseudo(pseudo)];
}
