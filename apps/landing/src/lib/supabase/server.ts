import { cookies } from 'next/headers';
import { createServerClient as createSupabaseServerClient, type CookieOptions } from '@supabase/ssr';
import type { Database } from '@bento-pop/supabase/types';

/**
 * Client Supabase SSR avec cookies (lecture publique anon).
 * À utiliser dans les composants serveur quand on a besoin d'une lecture
 * cohérente avec la session utilisateur (RLS anon).
 *
 * Renvoie `null` si les variables d'env ne sont pas configurées — l'appelant
 * peut alors basculer sur le contenu fallback (`content/thermometre.ts`).
 */
export async function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

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
          // Le `set` peut échouer dans un Server Component (read-only). C'est
          // normal — le middleware se charge déjà de poser les cookies.
        }
      },
    },
  });
}
