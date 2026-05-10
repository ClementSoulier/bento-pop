import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * Middleware d'auth Supabase, suivant le pattern officiel @supabase/ssr :
 *
 *   1. On crée `supabaseResponse` (NextResponse.next) qu'on RECONSTRUIT à
 *      chaque setAll côté Supabase, et auquel on rattache les cookies de
 *      refresh. Sinon les nouveaux cookies de session sont perdus dès qu'un
 *      redirect prend la main → boucle infinie de login.
 *   2. Si pas de user et pas sur /login → redirect vers /login (en
 *      réutilisant les cookies déjà posés sur supabaseResponse).
 *   3. Pas de check `admin_users` ici : runtime edge, on garde la vérif
 *      role pour les Server Components via `requireAdmin()` (lib/auth.ts).
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return supabaseResponse;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll().map(({ name, value }) => ({ name, value })),
      setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isLogin = pathname === '/login';

  if (!user && !isLogin) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    const redirect = NextResponse.redirect(loginUrl);
    // Préserve les cookies déjà posés par supabase pour ne pas invalider
    // un éventuel refresh token tout frais.
    supabaseResponse.cookies.getAll().forEach((c) => {
      redirect.cookies.set(c.name, c.value, c);
    });
    return redirect;
  }

  if (user && isLogin) {
    const home = request.nextUrl.clone();
    home.pathname = '/';
    home.searchParams.delete('next');
    const redirect = NextResponse.redirect(home);
    supabaseResponse.cookies.getAll().forEach((c) => {
      redirect.cookies.set(c.name, c.value, c);
    });
    return redirect;
  }

  return supabaseResponse;
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
};
