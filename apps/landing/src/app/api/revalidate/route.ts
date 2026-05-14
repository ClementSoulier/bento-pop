import { revalidatePath } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Revalidation on-demand : déclenchée par le BO admin après save/delete
 * d'un épisode (émission ou podcast). Le BO connaît le slug, il liste les
 * paths à purger.
 *
 * Authentification : header `Authorization: Bearer <REVALIDATE_TOKEN>`.
 * Le token est partagé via env var côté landing ET côté admin (server-only,
 * jamais NEXT_PUBLIC_*).
 *
 * Body JSON :
 * ```
 * { paths: ["/emissions/foo", "/sitemap.xml"] }
 * ```
 */
export async function POST(req: NextRequest) {
  const token = process.env.REVALIDATE_TOKEN;
  if (!token) {
    // Pas configuré → on refuse tout. Évite d'ouvrir un endpoint public
    // capable de purger le cache à volonté.
    return NextResponse.json({ error: 'Revalidation disabled' }, { status: 503 });
  }

  const auth = req.headers.get('authorization') ?? '';
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!provided || !timingSafeEqual(provided, token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const paths = extractPaths(body);
  if (!paths) {
    return NextResponse.json({ error: 'Body must be { paths: string[] }' }, { status: 400 });
  }

  const revalidated: string[] = [];
  for (const path of paths) {
    revalidatePath(path);
    revalidated.push(path);
  }

  return NextResponse.json({ revalidated });
}

function extractPaths(body: unknown): string[] | null {
  if (!body || typeof body !== 'object') return null;
  const raw = (body as { paths?: unknown }).paths;
  if (!Array.isArray(raw)) return null;
  const paths = raw.filter((p): p is string => typeof p === 'string' && p.length > 0 && p.length < 200);
  if (paths.length === 0) return null;
  return paths;
}

/**
 * Comparaison à temps constant pour éviter les timing attacks sur le token.
 * Utilise un XOR cumulatif au lieu de `===` qui short-circuit.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
