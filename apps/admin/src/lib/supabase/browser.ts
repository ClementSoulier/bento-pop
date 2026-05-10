'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@bento-pop/supabase/types';

/**
 * Client Supabase côté browser (navigateur).
 * Utilisé par la page de login pour signInWithPassword (pose les cookies de
 * session que le middleware lira ensuite).
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
