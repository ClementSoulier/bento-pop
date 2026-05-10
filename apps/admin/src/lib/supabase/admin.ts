import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@bento-pop/supabase/types';

/**
 * Client service-role — bypass RLS. Réservé aux opérations qui ne peuvent pas
 * passer par la session utilisateur (ex: ajouter manuellement un admin_users
 * via une action de bootstrap).
 *
 * En BO, on préfère systématiquement le client SSR (qui respecte RLS) pour
 * éviter les écarts d'autorisation.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
