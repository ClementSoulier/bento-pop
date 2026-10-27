import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/supabase/types';
import { toSocialLinks, type SocialLinks } from './social-links';

/**
 * Les appels du chantier 25 : écrire ses liens, lire ceux d'un compte, et
 * « Afficher mes réseaux ». L'écriture et la lecture passent par les
 * fonctions de la base, seul chemin des clients (§4) ; le réglage, par la
 * règle `users_update_own` et le droit de sa seule colonne.
 *
 * Le client est passé en argument, comme dans `follow-actions.ts`, pour être
 * testé contre un bouchon. Chaque appel lève une `Error` dont le message est
 * la clé de la base, que `socialErrorFor` traduit.
 */

export type SocialClient = SupabaseClient<Database>;

/** Racine des clés React Query des liens, pour les invalider d'un coup. */
export const SOCIAL_LINKS_ROOT = 'social-links';

/** Les liens d'un compte dépendent aussi de qui les lit (D3) : sa clé le porte. */
export const socialLinksKey = (userId: string, viewerId: string | null) =>
  [SOCIAL_LINKS_ROOT, userId, viewerId] as const;

function fail(error: { message: string } | null | undefined): never {
  throw new Error(error?.message ?? 'unknown');
}

/** Écrit ses deux liens ; `null` délie. Rend ce que la base a gardé. */
export async function setSocialLinks(
  client: SocialClient,
  instagram: string | null,
  tiktok: string | null,
): Promise<{ instagram: string | null; tiktok: string | null }> {
  const { data, error } = await client.rpc('set_social_links', { p_instagram: instagram, p_tiktok: tiktok });
  if (error) fail(error);
  const row = Array.isArray(data) ? data[0] : data;
  return { instagram: row?.instagram ?? null, tiktok: row?.tiktok ?? null };
}

/** Les liens d'un compte ; `null` sans lien, masqués, ou interrupteur éteint. */
export async function fetchSocialLinks(client: SocialClient, userId: string): Promise<SocialLinks | null> {
  const { data, error } = await client.rpc('social_links', { p_user: userId });
  if (error) fail(error);
  const row = Array.isArray(data) ? data[0] : data;
  return toSocialLinks(row ?? null);
}

/** « Afficher mes réseaux » (D3, D8). */
export async function writeSocialVisible(client: SocialClient, userId: string, on: boolean): Promise<void> {
  const { error } = await client.from('users').update({ social_visible: on }).eq('id', userId);
  if (error) fail(error);
}
