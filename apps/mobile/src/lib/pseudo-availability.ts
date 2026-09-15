import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/supabase/types';
import { escapeLikePattern, pickExactPseudo } from './pseudo-match';

export type PseudoClient = SupabaseClient<Database>;

/**
 * Vrai si un compte porte déjà ce pseudo, à la casse près.
 *
 * Client injecté, comme `public-bento.ts`, pour que la forme de la requête se
 * vérifie sous `node:test` ; `pseudo.ts`, qui importe le client, ne s'y charge
 * pas.
 *
 * Le joker `_` est échappé à la source. Sans ça, `limit(5)` pouvait couper la
 * bonne ligne dès que plus de cinq voisins répondaient au joker, et un pseudo
 * pris aurait été annoncé libre, pour échouer ensuite sur l'index unique à
 * l'inscription. `pickExactPseudo` reste en seconde ligne.
 *
 * Lève en cas d'erreur : l'appelant doit pouvoir distinguer « pris », « libre »
 * et « on ne sait pas ».
 */
export async function isPseudoTaken(client: PseudoClient, pseudo: string): Promise<boolean> {
  const wanted = pseudo.trim();
  const { data, error } = await client
    .from('users')
    .select('pseudo')
    .ilike('pseudo', escapeLikePattern(wanted))
    .limit(5);
  if (error) throw new Error(`Pseudo check failed: ${error.message}`);
  return pickExactPseudo(data ?? [], wanted) !== null;
}
