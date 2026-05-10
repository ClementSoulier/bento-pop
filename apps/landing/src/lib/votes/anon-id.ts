import { cookies } from 'next/headers';

/**
 * Lit le cookie `bp_anon_id` posé par le middleware.
 * En cas d'absence (cas pathologique : matcher du middleware n'a pas tourné),
 * pose le cookie à la volée et retourne le nouvel UUID.
 */
export async function ensureAnonId(): Promise<string> {
  const store = await cookies();
  const existing = store.get('bp_anon_id')?.value;
  if (existing) return existing;
  const fresh = crypto.randomUUID();
  store.set('bp_anon_id', fresh, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  });
  return fresh;
}
