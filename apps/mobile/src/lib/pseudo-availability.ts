import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/supabase/types';

export type PseudoClient = SupabaseClient<Database>;

/** Ce que la base dit d'un pseudo, cf. `pseudo_status`. */
export type ServerPseudoStatus = Database['public']['Functions']['pseudo_status']['Returns'];

const SERVER_STATUSES: readonly ServerPseudoStatus[] = [
  'invalid',
  'reserved',
  'forbidden',
  'taken',
  'current',
  'available',
];

/**
 * Ce que la base dit d'un pseudo, à la publication comme au changement
 * (chantier 21) : libre, pris par un pseudo actuel ou par l'ancien pseudo
 * d'un autre compte, réservé à la marque, non autorisé par les motifs
 * interdits, invalide, ou le sien.
 *
 * Avant le chantier 21, l'app lisait les pseudos actuels de `users` : elle
 * aurait annoncé libre un ancien pseudo réservé, que la base refuse ensuite.
 * La fonction compare en minuscules, sans joker : l'échappement de `_` qu'il
 * fallait à `ilike` n'a plus lieu d'être.
 *
 * Client injecté, comme `public-bento.ts`, pour que la forme de la requête se
 * vérifie sous `node:test` ; `pseudo.ts`, qui importe le client, ne s'y charge
 * pas.
 *
 * Lève en cas d'erreur, ou sur une réponse inconnue : l'appelant doit pouvoir
 * distinguer « pris », « libre » et « on ne sait pas ».
 */
export async function pseudoStatus(client: PseudoClient, pseudo: string): Promise<ServerPseudoStatus> {
  const { data, error } = await client.rpc('pseudo_status', { p_pseudo: pseudo.trim() });
  if (error) throw new Error(`Pseudo check failed: ${error.message}`);
  if (!SERVER_STATUSES.includes(data)) throw new Error(`Pseudo check failed: ${String(data)}`);
  return data;
}
