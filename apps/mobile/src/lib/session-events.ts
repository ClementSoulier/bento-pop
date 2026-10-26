import type { AuthChangeEvent } from '@supabase/supabase-js';

/**
 * Ce que l'app fait d'un évènement de session, chantier 28.
 *
 * `auth-js` prévient de tout ce qui arrive à la session : un renouvellement
 * (`TOKEN_REFRESHED`), une connexion (`SIGNED_IN`), une adresse vérifiée
 * (`USER_UPDATED`), une session effacée (`SIGNED_OUT`). Deux cas comptent
 * au-delà de suivre la session :
 *
 *   - **le compte arrive ou change** : la session que le lancement attendait
 *     (D5), ou celle d'un compte retrouvé. Le profil se relit ;
 *   - **la session disparaît sans qu'on l'ait demandé** : `auth-js` l'efface
 *     quand son renouvellement est refusé pour de bon. Un compte gardé se
 *     retrouve d'un code, un anonyme est perdu (D6).
 *
 * Pendant le lancement, un changement de compte ou une déconnexion voulue,
 * l'app conduit elle-même : l'évènement ne décide rien.
 *
 * Aucun import de `react-native` : testé sous `node:test`.
 */

export type SessionEventContext = {
  event: AuthChangeEvent;
  /** Le compte de la session reçue, ou `null`. */
  userId: string | null;
  /** Le compte que l'app suivait juste avant. */
  previousUserId: string | null;
  /** Le lancement, un changement de compte ou une déconnexion voulue est en cours. */
  steering: boolean;
};

export type SessionEventAction = 'none' | 'reload-profile' | 'session-lost';

export function sessionEventAction(ctx: SessionEventContext): SessionEventAction {
  if (ctx.steering) return 'none';
  if (ctx.event === 'SIGNED_OUT') return 'session-lost';
  if (ctx.userId && ctx.userId !== ctx.previousUserId) return 'reload-profile';
  return 'none';
}
