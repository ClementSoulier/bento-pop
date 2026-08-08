import path from 'node:path';
import type { NextConfig } from 'next';

/**
 * Hôte du projet Supabase, extrait de l'URL pour éviter de le hardcoder.
 * `NEXT_PUBLIC_SUPABASE_URL` est disponible au build (cf. les ARG du
 * Dockerfile). Sans elle, les images Storage retombent sur un `<img>` brut
 * via `SmartImage` plutôt que de faire échouer le build.
 */
function supabaseHostname(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

/** ⚠️ Doit rester synchronisé avec l'allowlist de `src/lib/images.ts`. */
const imageHosts = [supabaseHostname(), 'i.ytimg.com', 'img.youtube.com'].filter(
  (host): host is string => Boolean(host),
);

const nextConfig: NextConfig = {
  // Permet à Next d'importer les modules TS et les assets statiques (PNG/JPG)
  // depuis les packages workspace `@bento-pop/*`.
  transpilePackages: ['@bento-pop/brand', '@bento-pop/ui'],

  // En monorepo Turborepo, on remonte le tracing au root pour que les
  // packages workspace (@bento-pop/*) soient inclus dans le bundle de Vercel.
  outputFileTracingRoot: path.join(process.cwd(), '../..'),

  // Bundle minimal pour Docker / Coolify : génère .next/standalone avec
  // uniquement les deps réellement utilisées (server.js + node_modules pruné).
  output: 'standalone',

  reactStrictMode: true,

  /**
   * Optimisation d'images. L'enjeu principal n'est pas le poids des pages
   * mais l'egress Supabase : sans ça, chaque visiteur télécharge les photos
   * d'équipe et les miniatures d'épisodes directement depuis le Storage, en
   * taille d'origine. Ici le serveur Next les récupère une fois, les
   * redimensionne et les sert depuis son cache disque.
   */
  images: {
    remotePatterns: imageHosts.map((hostname) => ({
      protocol: 'https' as const,
      hostname,
    })),

    /**
     * 1 an. Durée de rétention des variantes optimisées ET `max-age` renvoyé
     * au navigateur. Sans surcharge, Next retombe à 60 s : il retéléphonerait
     * à Supabase toutes les minutes par image, soit pire que la situation
     * d'origine.
     *
     * Sans risque : côté source, les chemins Storage sont soit en UUID, soit
     * versionnés par un `?v={timestamp}` régénéré à chaque remplacement. Une
     * URL donnée ne change jamais de contenu.
     */
    minimumCacheTTL: 31_536_000,

    /**
     * On plafonne à 1920 : les originaux font 600 à 800 px de large, générer
     * des variantes 2048/3840 ne ferait qu'upscaler et brûler du CPU sur un
     * VPS 4 vCores partagé avec le reste de la stack.
     */
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],

    /**
     * WebP seul, sans AVIF : l'encodage AVIF coûte plusieurs secondes de CPU
     * par variante. À reconsidérer si le VPS grossit.
     */
    formats: ['image/webp'],
  },

  // Redirige toute requête arrivant sur le sous-domaine `www` vers le
  // domaine canonique sans `www`. Évite le contenu dupliqué côté SEO et
  // résout le signalement GSC "Exclue par balise noindex" sur
  // http://www.bento-pop.com/ (qui pointait avant sur la page parking OVH).
  // Prérequis : Coolify doit accepter le host `www.bento-pop.com` et
  // provisionner son cert SSL — sinon les requêtes ne touchent jamais Next.js.
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.bento-pop.com' }],
        destination: 'https://bento-pop.com/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
