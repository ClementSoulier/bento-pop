import { NextResponse, type NextRequest } from 'next/server';

const ANON_COOKIE = 'bp_anon_id';

/**
 * Pose un cookie httpOnly `bp_anon_id` (UUID v4) à la première visite.
 * Sert d'identifiant anonyme pour l'anti-double-vote du Thermomètre.
 * Aucune donnée personnelle — cookie strictement technique.
 */
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  if (!req.cookies.get(ANON_COOKIE)) {
    res.cookies.set(ANON_COOKIE, crypto.randomUUID(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });
  }
  return res;
}

export const config = {
  // SEO-critique : on limite le middleware à la home `/` uniquement.
  // Raison : dès qu'un middleware tourne sur une route, Next.js force un
  // header `Cache-Control: private, no-store` sur la réponse (puisqu'il
  // peut potentiellement personnaliser par utilisateur). Faire tourner le
  // middleware sur tout le site plombait le crawl budget Google sur
  // /emissions, /podcasts, /mentions-legales… alors que SEUL le bloc
  // Thermomètre (sur la home) a besoin du cookie anti-double-vote.
  // Les autres pages restent cacheables au bord (Coolify/CDN).
  matcher: ['/'],
};
