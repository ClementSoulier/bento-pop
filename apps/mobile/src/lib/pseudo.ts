import { supabase } from '@/supabase/client';
import { isPseudoTaken } from '@/lib/pseudo-availability';
import { PSEUDO_MAX, PSEUDO_MIN, PSEUDO_REGEX, isReservedPseudo } from '@/lib/pseudo-match';

// Les règles vivent dans `pseudo-match.ts`, chargeable sans client Supabase :
// `public-bento.ts` en a besoin sous `node:test`. Réexportées pour les écrans.
export { PSEUDO_MAX, PSEUDO_MIN, PSEUDO_REGEX, isReservedPseudo };

export type PseudoCheck =
  | { status: 'idle' }
  | { status: 'too-short' }
  | { status: 'too-long' }
  | { status: 'invalid' }
  | { status: 'checking' }
  | { status: 'available' }
  | { status: 'taken' }
  | { status: 'reserved' }
  | { status: 'error' };

/**
 * Valide le format localement (zéro round-trip) puis interroge Supabase
 * pour vérifier la disponibilité.
 *
 * RLS : `users` est en lecture publique, donc le client anon peut sonder
 * sans authentification spéciale.
 *
 * La correspondance exacte, joker `_` échappé, vit dans
 * `pseudo-availability.ts` : sans elle, `dark_hifus` serait annoncé « pris »
 * dès qu'un `darkahifus` existe.
 */
export async function checkPseudoAvailability(raw: string): Promise<PseudoCheck> {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { status: 'idle' };
  if (trimmed.length < PSEUDO_MIN) return { status: 'too-short' };
  if (trimmed.length > PSEUDO_MAX) return { status: 'too-long' };
  if (!PSEUDO_REGEX.test(trimmed)) return { status: 'invalid' };
  // Réservé à la marque : la base le refuse, autant le dire avant la validation.
  if (isReservedPseudo(trimmed)) return { status: 'reserved' };

  try {
    return { status: (await isPseudoTaken(supabase, trimmed)) ? 'taken' : 'available' };
  } catch {
    return { status: 'error' };
  }
}

/**
 * Génère 5 suggestions de pseudos dérivés du pseudo souhaité, dans le style
 * du design Claude Design (nao_92, naomi.k, nao_pop, naoxbento, nao_culture).
 *
 * Les suggestions qui tombent sous un motif réservé à la marque sont écartées :
 * sur un champ vide, le modèle donnait « bento_pop », que la base refuse.
 */
export function generatePseudoSuggestions(base: string): string[] {
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, '')
    .slice(0, 10) || 'bento';
  return [
    `${slug}${randomDigits(2)}`,
    `${slug}.k`,
    `${slug}_pop`,
    `${slug}xbento`,
    `${slug}_culture`,
  ].filter((pseudo) => !isReservedPseudo(pseudo));
}

function randomDigits(n: number): string {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');
}
