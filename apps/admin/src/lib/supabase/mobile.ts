import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@bento-pop/supabase-mobile/types';

/**
 * Client Supabase pour le projet MOBILE (« Mon Bento Pop »).
 *
 * Le BO admin gère deux projets Supabase distincts :
 *   - landing (`/supabase/`) : events/polls/team/links — auth admin
 *   - mobile  (`/apps/mobile/supabase/`) : users, bentos, items —
 *     anonymous sign-in pour les utilisateurs finaux
 *
 * Pour les opérations admin (toggle is_featured d'un bento), on utilise la
 * service-role key du projet mobile : bypass RLS, accès écriture complet.
 * Cette key ne quitte JAMAIS le serveur (`'server-only'` import).
 *
 * Types : importés depuis `@bento-pop/supabase-mobile` (package partagé
 * avec apps/mobile pour éviter la dup historique).
 */

export type { Database } from '@bento-pop/supabase-mobile/types';

/**
 * Crée le client mobile en service-role. Retourne `null` si les env vars
 * ne sont pas configurées (cas dev sans BO mobile activé).
 */
export function createMobileClient() {
  const url = process.env.MOBILE_SUPABASE_URL;
  const serviceKey = process.env.MOBILE_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
