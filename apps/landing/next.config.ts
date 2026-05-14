import path from 'node:path';
import type { NextConfig } from 'next';

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
