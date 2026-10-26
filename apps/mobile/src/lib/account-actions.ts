import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '@/supabase/types';
import { normalizeEmail } from './account';

/**
 * Les appels du chantier 28 : garder son compte, se reconnecter, supprimer.
 *
 * Le client est passé en argument, comme dans `matches.ts`, pour être testé
 * contre un bouchon sous `node:test`. Chaque appel lève l'erreur de
 * l'authentification telle quelle ; `accountErrorMessage` la traduit.
 *
 * Les types de `verifyOtp` sont ceux que la pile locale a acceptés, contrôles
 * 1 et 4 de `scripts/check-account.mjs` : `email_change` pour une adresse
 * qu'on rattache, `email` pour une reconnexion.
 */

export type AccountClient = SupabaseClient<Database>;

/**
 * Garder son compte, étape 1 : un code à l'adresse (D1). L'adresse n'est
 * rattachée qu'au code juste (D7) : jusque-là, le compte reste anonyme.
 */
export async function requestKeepCode(client: AccountClient, rawEmail: string): Promise<string> {
  const email = normalizeEmail(rawEmail);
  const { error } = await client.auth.updateUser({ email });
  if (error) throw error;
  return email;
}

/** Garder son compte, étape 2 : le code. L'identifiant ne change pas. */
export async function confirmKeepCode(client: AccountClient, email: string, code: string): Promise<User> {
  const { data, error } = await client.auth.verifyOtp({ email, token: code, type: 'email_change' });
  if (error) throw error;
  if (!data.user) throw new Error('Code vérifié sans compte en retour');
  return data.user;
}

/**
 * Se reconnecter, étape 1 : un code à l'adresse d'un compte gardé. Sans
 * compte à cette adresse, GoTrue refuse (`otp_disabled`) et n'en crée aucun.
 */
export async function requestSignInCode(client: AccountClient, rawEmail: string): Promise<string> {
  const email = normalizeEmail(rawEmail);
  const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (error) throw error;
  return email;
}

/**
 * Se reconnecter, étape 2 : le code, vérifié **sur un client à part**, sans
 * stockage (`createSignInClient`). La session du téléphone reste en place
 * pendant ce temps : c'est elle qui efface le compte vide qu'on abandonne
 * (D2), avant de laisser sa place à la session rendue ici.
 */
export async function confirmSignInCode(
  signInClient: AccountClient,
  email: string,
  code: string,
): Promise<Session> {
  const { data, error } = await signInClient.auth.verifyOtp({ email, token: code, type: 'email' });
  if (error) throw error;
  if (!data.session) throw new Error('Code vérifié sans session en retour');
  return data.session;
}

/** Supprime le compte de la session : profil, compte d'authentification et adresse (D8). */
export async function deleteOwnAccountNow(client: AccountClient): Promise<void> {
  const { error } = await client.rpc('delete_own_account');
  if (error) throw error;
}
