import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@bento-pop/supabase-mobile/types';

/**
 * Opérations partagées sur les comptes du projet mobile.
 *
 * Vit ici et non dans les actions d'une page parce que **deux écrans les
 * appellent** : la liste des bentos et la liste des utilisateurs. Une
 * duplication serait bien pire ici qu'ailleurs, la suppression étant
 * irréversible.
 */

type MobileClient = SupabaseClient<Database>;

/**
 * Supprime intégralement un compte : le profil et, s'il en a un, le compte
 * d'authentification.
 *
 * **Les deux suppressions sont nécessaires depuis la migration
 * `20260913000000_admin_users.sql`.** Avant elle,
 * `public.users.id` référençait `auth.users(id) on delete cascade`, et
 * supprimer le compte suffisait à tout emporter. La clé étrangère a été
 * retirée pour qu'un profil éditorial puisse exister sans compte, donc
 * `auth.admin.deleteUser` seul laisserait désormais le profil, son bento et
 * ses cases en place : un bento visible dans le fil, rattaché à quelqu'un qui
 * n'existe plus.
 *
 * L'ordre compte. On supprime **le profil d'abord** : c'est lui qui porte la
 * cascade vers `bentos` et `bento_items`, donc en cas d'interruption on
 * préfère un compte d'authentification orphelin, invisible et sans donnée, à
 * un bento orphelin visible de tous.
 *
 * Un profil éditorial n'a pas de compte d'authentification : la suppression
 * côté `auth` échoue alors avec un 404, ce qui n'est pas une erreur ici.
 */
export async function deleteMobileAccount(
  mobile: MobileClient,
  userId: string,
  options: { hasAuthAccount: boolean },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error: profileError } = await mobile.from('users').delete().eq('id', userId);
  if (profileError) return { ok: false, error: profileError.message };

  if (options.hasAuthAccount) {
    const { error: authError } = await mobile.auth.admin.deleteUser(userId);
    // Le profil est déjà parti : signaler l'échec plutôt que de le taire,
    // sans quoi un compte d'authentification resterait sans que personne
    // ne le sache.
    if (authError) {
      return {
        ok: false,
        error: `Profil supprimé, mais le compte d'authentification subsiste : ${authError.message}`,
      };
    }
  }

  return { ok: true };
}
