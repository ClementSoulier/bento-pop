/**
 * Ce que le champ du pseudo dit sous lui, au moment de publier (chantier 32,
 * D12, `u01`) : l'adresse tant qu'il n'y a rien à dire, « On vérifie… », « Libre »
 * en succès, ou ce qui ne va pas, en erreur, avec de quoi s'en sortir. Le guide
 * écrit la phrase du pseudo pris : « Ce pseudo est déjà pris. Essaie
 * @bento_culture. » Aucun import de `react-native` : les tests lisent ce module.
 */
import type { PseudoCheck } from './pseudo';
import { PSEUDO_MAX, PSEUDO_MIN } from './pseudo-match';

export type PseudoLine =
  | { kind: 'helper'; text: string }
  | { kind: 'success'; text: string }
  | { kind: 'error'; text: string };

/** L'adresse publique du bento, sous le champ tant qu'il n'y a rien d'autre à dire. */
export function pseudoAddress(pseudo: string): string {
  return `bento-pop.com/u/${pseudo.trim() || 'ton_pseudo'}`;
}

/**
 * La ligne sous le champ. `suggestion` : un pseudo à proposer quand celui-ci est
 * pris ou réservé, la dernière des suggestions de l'écran (« _culture »).
 */
export function pseudoLine(pseudo: string, check: PseudoCheck, suggestion?: string): PseudoLine {
  const instead = suggestion ? ` Essaie @${suggestion}.` : '';
  switch (check.status) {
    case 'idle':
    case 'current':
      return { kind: 'helper', text: pseudoAddress(pseudo) };
    case 'checking':
      return { kind: 'helper', text: 'On vérifie…' };
    case 'available':
      return { kind: 'success', text: 'Libre' };
    case 'taken':
      return { kind: 'error', text: `Ce pseudo est déjà pris.${instead}` };
    case 'reserved':
      return { kind: 'error', text: `Ce pseudo est réservé.${instead}` };
    case 'forbidden':
      return { kind: 'error', text: 'Ce pseudo n’est pas autorisé. Choisis-en un autre.' };
    case 'too-short':
      return { kind: 'error', text: `Trop court : ${PSEUDO_MIN} caractères au moins.` };
    case 'too-long':
      return { kind: 'error', text: `Trop long : ${PSEUDO_MAX} caractères au plus.` };
    case 'invalid':
      return { kind: 'error', text: 'Lettres, chiffres, points et underscores seulement.' };
    case 'error':
      return { kind: 'error', text: 'La vérification n’a pas abouti. Réessaie dans un instant.' };
  }
}
