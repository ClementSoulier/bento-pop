import { cookies } from 'next/headers';
import { createServerClient as createSupabaseServerClient, type CookieOptions } from '@supabase/ssr';
import type { Database } from '@bento-pop/supabase/types';

/**
 * Client Supabase SSR avec cookies (lecture cohérente avec la session
 * utilisateur). À utiliser dans les routes/loaders qui dépendent de l'état
 * d'auth (votes personnalisés, prévisualisation admin, etc.).
 *
 * ⚠️ Cookies = contexte requête uniquement. À NE PAS utiliser depuis :
 *  - `generateStaticParams`
 *  - une page avec `export const revalidate` ou en SSG
 *  - le sitemap, robots, ou tout endpoint pré-rendu
 * Pour ces cas, utiliser `createAnonServerClient()`.
 *
 * Renvoie `null` si les variables d'env ne sont pas configurées.
 */
export async function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  try {
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
  } catch (err) {
    console.error('[supabase/server] createServerClient failed:', err);
    return null;
  }
}

/**
 * Client Supabase anon sans cookies — sûr en contexte SSG / ISR / build.
 *
 * Les politiques RLS pour les contenus publics du landing autorisent la
 * lecture anon des lignes `status = 'published'`, donc ce client est
 * suffisant pour rendre les pages publiques (sitemap, hub, slug pages).
 *
 * Différence vs `createServerClient()` :
 * - Ne lit pas les cookies → utilisable depuis `generateStaticParams`,
 *   pages ISR, sitemap, etc.
 * - Ne voit jamais les contenus `status = 'draft'`.
 */
export function createAnonServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  return createSupabaseServerClient<Database>(url, anonKey, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}
