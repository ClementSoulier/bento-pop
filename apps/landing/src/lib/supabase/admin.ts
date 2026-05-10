import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@bento-pop/supabase/types';

/**
 * Client Supabase service-role — *jamais* exposé au navigateur.
 * Utilisé uniquement dans les Server Actions pour les écritures protégées
 * par RLS (votes, newsletter).
 *
 * Renvoie `null` si les variables d'env manquent — l'appelant doit alors
 * répondre une erreur fonctionnelle (formulaire non-traité).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
