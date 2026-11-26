import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  decideAccess,
  deniedRedirect,
  type AccessState,
  type AdminRole,
  type AdminSession,
  type RoleLookup,
} from '@/lib/access';

export type { AccessState, AdminSession };

/**
 * État d'accès de la requête en cours (cf. `lib/access.ts`).
 *
 * Stratégie en 2 temps :
 *   1. SSR client (cookies aware) → vérifie que la session JWT est valide
 *      via `auth.getUser()` (réseau vers Supabase, anti-tampering).
 *   2. Service-role client → vérifie l'appartenance à `admin_users`.
 *      On bypass volontairement la RLS sur cette table car on a déjà
 *      authentifié le user à l'étape 1 ; ça évite tout aléa lié aux
 *      policies RLS récursives ou aux subtilités de timing JWT/cookies.
 *
 * Cached pour partager le résultat entre Server Components d'une même req.
 */
export const getAccessState = cache(async (): Promise<AccessState> => {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return decideAccess(null, { ok: true, role: null });

  const admin = createAdminClient();
  if (!admin) {
    console.warn('[admin/auth] SUPABASE_SERVICE_ROLE_KEY manquante.');
    return decideAccess(user, { ok: false });
  }
  const { data, error } = await admin
    .from('admin_users')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) console.warn('[admin/auth] lecture de admin_users en échec :', error.message);
  const lookup: RoleLookup = error
    ? { ok: false }
    : { ok: true, role: (data as { role: AdminRole } | null)?.role ?? null };
  return decideAccess(user, lookup);
});

/** La session admin, ou `null` si la personne n'est pas connectée ou pas admin. */
export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  const state = await getAccessState();
  return state.kind === 'admin' ? state.session : null;
});

/**
 * Garde-fou pour les pages protégées : /login sans session, /acces-refuse pour un
 * compte connecté qui n'est pas dans `admin_users`. À appeler en tête de chaque
 * Server Component de page protégée et de chaque action serveur.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const state = await getAccessState();
  if (state.kind !== 'admin') redirect(deniedRedirect(state) ?? '/login');
  return state.session;
}
