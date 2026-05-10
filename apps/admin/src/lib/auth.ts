import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export type AdminSession = {
  userId: string;
  email: string;
  role: 'admin' | 'editor';
};

/**
 * Charge la session BO en cours.
 *
 * Stratégie en 2 temps :
 *   1. SSR client (cookies aware) → vérifie que la session JWT est valide
 *      via `auth.getUser()` (réseau vers Supabase, anti-tampering).
 *   2. Service-role client → vérifie l'appartenance à `admin_users`.
 *      On bypass volontairement la RLS sur cette table car on a déjà
 *      authentifié le user à l'étape 1 ; ça évite tout aléa lié aux
 *      policies RLS récursives ou aux subtilités de timing JWT/cookies
 *      qui produisaient une boucle de redirect /login ↔ /.
 *
 * Retourne `null` si non connecté ou pas admin → l'appelant redirige.
 * Cached pour partager le résultat entre Server Components d'une même req.
 */
export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  if (!admin) {
    console.warn('[admin/auth] SUPABASE_SERVICE_ROLE_KEY manquante.');
    return null;
  }
  const { data, error } = await admin
    .from('admin_users')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error || !data) return null;

  const row = data as unknown as { role: 'admin' | 'editor' };
  return {
    userId: user.id,
    email: user.email ?? '',
    role: row.role,
  };
});

/**
 * Garde-fou pour les pages protégées : redirige vers /login si pas authentifié
 * ou pas admin. À appeler en tête de chaque Server Component de page protégée.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect('/login');
  return session;
}
