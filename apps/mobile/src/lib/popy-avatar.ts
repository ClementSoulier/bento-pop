import popyContent from '@bento-pop/brand/assets/mascot/popy-content.png';
import popyDiable from '@bento-pop/brand/assets/mascot/popy-diable.png';
import popyFille from '@bento-pop/brand/assets/mascot/popy-fille.png';
import popyGene from '@bento-pop/brand/assets/mascot/popy-gene.png';
import popyIntello from '@bento-pop/brand/assets/mascot/popy-intello.png';
import popyNani from '@bento-pop/brand/assets/mascot/popy-nani.png';
import { popyKeyForPseudo, type PopyKey } from '@bento-pop/supabase-mobile/bento';

/**
 * Avatar Popy déterministe par pseudo.
 *
 * La *sélection* vit dans `@bento-pop/supabase-mobile/bento`, partagée
 * avec la landing : un même pseudo doit afficher le même Popy dans l'app
 * et sur sa page publique. Seule la correspondance vers le fichier est
 * propre à la plateforme, l'app passant par Metro et le web par
 * `next/image`.
 *
 * À la v2 (claim avec mot de passe), une colonne `users.avatar`
 * permettra le choix manuel ; la valeur par défaut restera celle-ci.
 */

const ACCENTS: Readonly<Record<PopyKey, string>> = {
  content: '#fbbf24',
  intello: '#3b82a8',
  fille: '#ff5588',
  gene: '#8b5cf6',
  nani: '#2ec4b6',
  diable: '#e63946',
};

const SOURCES: Readonly<Record<PopyKey, number>> = {
  content: popyContent,
  intello: popyIntello,
  fille: popyFille,
  gene: popyGene,
  nani: popyNani,
  diable: popyDiable,
};

export type Popy = { key: PopyKey; source: number; accent: string };

export function popyForPseudo(pseudo: string): Popy {
  const key = popyKeyForPseudo(pseudo);
  return { key, source: SOURCES[key], accent: ACCENTS[key] };
}
