import { supabase } from '@/supabase/client';

/**
 * Règles de validation du pseudo, alignées avec la contrainte SQL
 * `users.pseudo_format` (cf. migration initiale).
 */
export const PSEUDO_REGEX = /^[A-Za-z0-9_.]{3,20}$/;
export const PSEUDO_MIN = 3;
export const PSEUDO_MAX = 20;

export type PseudoCheck =
  | { status: 'idle' }
  | { status: 'too-short' }
  | { status: 'too-long' }
  | { status: 'invalid' }
  | { status: 'checking' }
  | { status: 'available' }
  | { status: 'taken' }
  | { status: 'error' };

/**
 * Valide le format localement (zéro round-trip) puis interroge Supabase
 * pour vérifier la disponibilité.
 *
 * RLS : `users` est en lecture publique, donc le client anon peut sonder
 * sans authentification spéciale.
 */
export async function checkPseudoAvailability(raw: string): Promise<PseudoCheck> {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { status: 'idle' };
  if (trimmed.length < PSEUDO_MIN) return { status: 'too-short' };
  if (trimmed.length > PSEUDO_MAX) return { status: 'too-long' };
  if (!PSEUDO_REGEX.test(trimmed)) return { status: 'invalid' };

  // Index unique case-insensitive côté DB — on cherche en lowercase pour
  // matcher la même clé.
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .ilike('pseudo', trimmed)
    .maybeSingle();

  if (error) return { status: 'error' };
  return { status: data ? 'taken' : 'available' };
}

/**
 * Génère 5 suggestions de pseudos dérivés du pseudo souhaité, dans le style
 * du design Claude Design (nao_92, naomi.k, nao_pop, naoxbento, nao_culture).
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
  ];
}

function randomDigits(n: number): string {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');
}
