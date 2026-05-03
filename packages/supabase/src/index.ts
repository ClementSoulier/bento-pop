import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export type { Database };
export type BentoPopSupabaseClient = SupabaseClient<Database>;

/**
 * Crée un client Supabase typé.
 *
 * Les variables d'environnement attendues côté app :
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * V1 — pas encore branché à un projet réel. Le squelette est posé pour
 * éviter une refonte au moment de la deuxième app.
 */
export function createClient(
  url: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
): BentoPopSupabaseClient {
  if (!url || !anonKey) {
    throw new Error(
      '[@bento-pop/supabase] NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY sont requis.',
    );
  }
  return createSupabaseClient<Database>(url, anonKey);
}
