import popyContent from '@bento-pop/brand/assets/mascot/popy-content.png';
import popyDiable from '@bento-pop/brand/assets/mascot/popy-diable.png';
import popyFille from '@bento-pop/brand/assets/mascot/popy-fille.png';
import popyGene from '@bento-pop/brand/assets/mascot/popy-gene.png';
import popyIntello from '@bento-pop/brand/assets/mascot/popy-intello.png';
import popyNani from '@bento-pop/brand/assets/mascot/popy-nani.png';
import { POPY_KEYS, popyKeyFor, type PopyKey } from '@bento-pop/supabase-mobile/bento';

/**
 * Avatar Popy d'un compte : celui qu'il a choisi, `users.avatar`, ou celui
 * que son pseudo tire, déterministe (chantier 21, D7).
 *
 * La *sélection* vit dans `@bento-pop/supabase-mobile/bento`, partagée
 * avec la landing : un même compte doit afficher le même Popy dans l'app
 * et sur sa page publique. Seule la correspondance vers le fichier est
 * propre à la plateforme, l'app passant par Metro et le web par
 * `next/image`.
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

/** Le nom de chaque Popy, pour le choisir et pour VoiceOver. */
const NAMES: Readonly<Record<PopyKey, string>> = {
  content: 'Popy content',
  intello: 'Popy intello',
  fille: 'Popy bisou',
  gene: 'Popy gêné',
  nani: 'Popy surpris',
  diable: 'Popy diable',
};

export type Popy = { key: PopyKey; source: number; accent: string; name: string };

function popyOf(key: PopyKey): Popy {
  return { key, source: SOURCES[key], accent: ACCENTS[key], name: NAMES[key] };
}

/** Le Popy d'un compte, choisi ou tiré de son pseudo. */
export function popyFor(pseudo: string, avatar: string | null | undefined): Popy {
  return popyOf(popyKeyFor(pseudo, avatar));
}

/**
 * Le Popy que tire un pseudo seul : pour un pseudo qu'aucun compte ne porte
 * encore, à la saisie de la publication. Un compte passe par `popyFor`.
 */
export function popyForPseudo(pseudo: string): Popy {
  return popyFor(pseudo, null);
}

/** Les six, dans l'ordre de `POPY_KEYS` : le choix de l'écran de profil. */
export const POPY_CHOICES: readonly Popy[] = POPY_KEYS.map(popyOf);
