import path from 'node:path';
import type { NextConfig } from 'next';

/**
 * Hôte d'un projet Supabase, extrait de son URL pour éviter de le hardcoder.
 * Les `NEXT_PUBLIC_*` sont disponibles au build (cf. les ARG du Dockerfile).
 * Sans elles, les images Storage retombent sur un `<img>` brut via
 * `SmartImage` plutôt que de faire échouer le build.
 */
function hostnameOf(rawUrl: string | undefined): string | null {
  if (!rawUrl) return null;
  try {
    return new URL(rawUrl).hostname;
  } catch {
    return null;
  }
}

/**
 * ⚠️ Doit rester synchronisé avec l'allowlist de `src/lib/images.ts`.
 *
 * Deux projets Supabase : le projet landing (photos d'équipe, miniatures
 * d'épisodes) et le projet mobile (illustrations du catalogue `items`,
 * affichées par la page publique `/u/[pseudo]`). Deux `project-ref`, donc
 * deux hostnames distincts.
 *
 * Les trois hôtes tiers ci-dessous sont ceux réellement présents dans le
 * catalogue mobile en production (relevé du 11 septembre 2026, sur 205
 * items illustrés) :
 *
 *   ggjgktbcqumfxrixcdyx.supabase.co  117   bucket `item-images` (catalogue maison)
 *   image.tmdb.org                     82   affiches TMDb (items historiques)
 *   upload.wikimedia.org                5   photos Wikimedia Commons
 *   coverartarchive.org                 1   pochettes MusicBrainz
 *
 * Les items historiques pointent encore vers les APIs externes ; le
 * rapatriement vers le Storage est progressif. Sans ces hôtes, les trois
 * quarts des illustrations contourneraient l'optimiseur (cf. le fallback
 * `<img>` de `SmartImage`) et seraient téléchargées en taille d'origine
 * par chaque visiteur, directement chez les tiers.
 *
 * Ce sont des hostnames fixes, sans joker : pas de proxy d'images ouvert.
 */
const imageHosts = [
  hostnameOf(process.env.NEXT_PUBLIC_SUPABASE_URL),
  hostnameOf(process.env.NEXT_PUBLIC_MOBILE_SUPABASE_URL),
  'i.ytimg.com',
  'img.youtube.com',
  'image.tmdb.org',
  'upload.wikimedia.org',
  'coverartarchive.org',
].filter((host): host is string => Boolean(host));

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
