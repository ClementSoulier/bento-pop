import { confirmSignInCode } from '@/lib/account-actions';
import { deleteOwnAccount } from '@/lib/bento-actions';
import { forgetReadyReminders, refreshPush } from '@/lib/push-runtime';
import { createSignInClient } from '@/supabase/client';
import { useSession } from './session';

/**
 * Les gestes du chantier 28 qui touchent plus que la session : les rappels de
 * bento prêt (chantier 8) et l'appareil des notifications (chantier 17).
 *
 * À part de `session.ts` : `push-runtime` lit déjà la session, et la session
 * qui l'importerait ferait une boucle.
 */

/**
 * « J'ai déjà un compte » et « Reconnecte-toi », dernière étape : le code
 * vérifié sur un client à part, puis la bascule sur le compte retrouvé.
 * `dropCurrent` efface le compte de ce téléphone (D2, D9).
 */
export async function signInWithCode(
  email: string,
  code: string,
  { dropCurrent }: { dropCurrent: boolean },
): Promise<void> {
  const session = await confirmSignInCode(createSignInClient(), email, code);
  await useSession.getState().switchTo(session, { dropCurrent });
  // Les rappels du compte quitté partent avec lui. L'appareil passe au compte
  // retrouvé : `register_push_token` donne son jeton au dernier qui
  // l'enregistre.
  await forgetReadyReminders().catch((e) => console.warn('[compte] rappels', e));
  void refreshPush(true);
}

/** « Se déconnecter », pour un compte gardé (D10). */
export async function signOutAccount(): Promise<void> {
  await forgetReadyReminders().catch((e) => console.warn('[compte] rappels', e));
  await useSession.getState().resetAndReinit();
}

/** « Supprimer mon compte » (D8), puis l'app repart de zéro. */
export async function deleteAccountAndRestart(): Promise<void> {
  await deleteOwnAccount();
  // Chantier 8 : ses rappels de bento prêt partent avec lui.
  await forgetReadyReminders();
  await useSession.getState().resetAndReinit();
}
