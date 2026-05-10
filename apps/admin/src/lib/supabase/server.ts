import { cookies } from 'next/headers';
import { createServerClient as createSupabaseServerClient, type CookieOptions } from '@supabase/ssr';
import type { Database } from '@bento-pop/supabase/types';

/**
 * Client Supabase SSR pour les Server Components / Server Actions du BO.
 * Lit la session depuis les cookies (utilisateur connecté), respecte RLS.
 */
export async function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('[admin] NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY requises.');
  }

  const cookieStore = await cookies();
  return createSupabaseServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll().map(({ name, value }) => ({ name, value })),
      setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Component lecture seule — le middleware s'occupe d'écrire les cookies.
        }
      },
    },
  });
}
