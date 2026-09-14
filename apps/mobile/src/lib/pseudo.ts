import { supabase } from '@/supabase/client';
import { PSEUDO_MAX, PSEUDO_MIN, PSEUDO_REGEX, pickExactPseudo } from '@/lib/pseudo-match';

// Les règles vivent dans `pseudo-match.ts`, chargeable sans client Supabase :
// `public-bento.ts` en a besoin sous `node:test`. Réexportées pour les écrans.
export { PSEUDO_MAX, PSEUDO_MIN, PSEUDO_REGEX };

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
 * Recherche un utilisateur par son pseudo, en correspondance **exacte** à
 * la casse près.
 *
 * PostgREST n'a pas d'opérateur « égal en ignorant la casse ». On passe
 * donc par `ilike`, mais `_` y est le joker « un caractère », et il est
 * autorisé par la contrainte SQL sur `pseudo` : `ilike('pseudo',
 * 'dark_hifus')` remonte aussi `darkahifus`.
 *
 * Deux conséquences, toutes deux constatées :
 *   - un pseudo libre contenant `_` pouvait être annoncé « pris » ;
 *   - un lien profond `bentopop://u/buyt_k` affichait le bento de
 *     `buyt.k`.
 *
 * On ramène donc un petit lot et on ne retient que la vraie
 * correspondance. L'index unique sur `lower(pseudo)` en garantit au plus
 * une. `maybeSingle()` est écarté : il échoue dès que le joker en
 * remonte deux.
 */
export async function findUserByPseudo<T extends string>(
  columns: T,
  pseudo: string,
): Promise<Record<string, unknown> | null> {
  const wanted = pseudo.trim();
  if (!PSEUDO_REGEX.test(wanted)) return null;

  const { data, error } = await supabase
    .from('users')
    .select(columns)
    .ilike('pseudo', wanted)
    .limit(5);
  if (error || !data) return null;

  return pickExactPseudo(data as unknown as { pseudo: string }[], wanted);
}

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

  // Correspondance exacte : sans elle, `dark_hifus` serait annoncé
  // « pris » dès qu'un `darkahifus` existe, le `_` étant un joker.
  const { data, error } = await supabase
    .from('users')
    .select('pseudo')
    .ilike('pseudo', trimmed)
    .limit(5);

  if (error) return { status: 'error' };
  return { status: pickExactPseudo(data ?? [], trimmed) ? 'taken' : 'available' };
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
