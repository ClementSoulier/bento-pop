/**
 * Décision d'accès au back-office, sans dépendance à Next ni à Supabase pour être
 * testée seule. `lib/auth.ts` lui fournit l'utilisateur et le résultat de la lecture
 * de `admin_users`.
 *
 * Trois cas, et non deux : un compte connecté mais absent de `admin_users` n'est pas
 * un visiteur anonyme. Le renvoyer vers /login le faisait tourner en boucle, puisque
 * le middleware renvoie toute session valide de /login vers / (26/11/2026, compte de
 * Florian créé après le premier administrateur).
 */

export type AdminRole = 'admin' | 'editor';

export type AdminSession = {
  userId: string;
  email: string;
  role: AdminRole;
};

/** Résultat de la lecture de `admin_users` pour l'utilisateur connecté. */
export type RoleLookup =
  | { ok: true; role: AdminRole | null }
  /** Clé de service absente ou lecture en erreur : droits impossibles à vérifier. */
  | { ok: false };

export type AccessState =
  | { kind: 'anonymous' }
  | { kind: 'denied'; email: string; reason: 'not_listed' | 'unverifiable' }
  | { kind: 'admin'; session: AdminSession };

export function decideAccess(
  user: { id: string; email?: string | null } | null,
  lookup: RoleLookup,
): AccessState {
  if (!user) return { kind: 'anonymous' };
  const email = user.email ?? '';
  if (!lookup.ok) return { kind: 'denied', email, reason: 'unverifiable' };
  if (!lookup.role) return { kind: 'denied', email, reason: 'not_listed' };
  return { kind: 'admin', session: { userId: user.id, email, role: lookup.role } };
}

/** Où envoyer la personne quand une page protégée refuse l'accès. */
export function deniedRedirect(state: AccessState): string | null {
  if (state.kind === 'anonymous') return '/login';
  if (state.kind === 'denied') return '/acces-refuse';
  return null;
}
