import type { SupabaseClient } from '@supabase/supabase-js';
import type { BentoWhyRow, Database } from '@/supabase/types';
import { cleanWhy } from './whys';

/**
 * Les appels du chantier 12 : écrire un pourquoi, lire les siens. Les deux
 * passent par les fonctions de la base, seul chemin d'écriture des clients
 * (§6.2) ; les autres lisent les pourquoi dans la requête de la page,
 * `public-bento.ts`.
 *
 * Le client est passé en argument, comme dans `social-actions.ts`, pour être
 * testé contre un bouchon. Chaque appel lève une `Error` dont le message est
 * la clé de la base (`why_refused_filter`, …), que `whyErrorMessage` traduit.
 */

export type WhyClient = SupabaseClient<Database>;

function fail(error: { message: string } | null | undefined): never {
  throw new Error(error?.message ?? 'unknown');
}

/**
 * Écrit, remplace ou, vide, efface le pourquoi d'une case de son bento. Rend
 * la ligne telle que la base la garde, `null` quand elle s'efface.
 */
export async function setWhy(
  client: WhyClient,
  bentoId: string,
  caseKey: string,
  body: string,
): Promise<BentoWhyRow | null> {
  const { data, error } = await client.rpc('set_bento_why', {
    p_bento: bentoId,
    p_case: caseKey,
    p_body: cleanWhy(body),
  });
  if (error) fail(error);
  const row = Array.isArray(data) ? data[0] : data;
  return row ?? null;
}

/** Les pourquoi de son bento, masqués compris, avec leur motif (D8). */
export async function fetchOwnWhys(client: WhyClient, bentoId: string): Promise<BentoWhyRow[]> {
  const { data, error } = await client.rpc('my_bento_whys', { p_bento: bentoId });
  if (error) fail(error);
  return data ?? [];
}
