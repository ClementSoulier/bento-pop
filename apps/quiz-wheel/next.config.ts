import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Permet à Next d'importer les modules TS et les assets statiques (PNG/JPG)
  // depuis les packages workspace `@bento-pop/*`.
  transpilePackages: ['@bento-pop/brand', '@bento-pop/ui'],

  // Build autonome pour le mode régie hors-ligne. Génère un dossier
  // `.next/standalone/` qui contient le serveur Node + les deps traçées.
  // Voir `pnpm build:offline` / `start:offline` dans package.json.
  output: 'standalone',
  // En monorepo Turborepo, on remonte le tracing au root pour que les
  // packages workspace (@bento-pop/*) soient inclus dans le bundle.
  outputFileTracingRoot: path.join(process.cwd(), '../..'),

  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ['framer-motion'],
  },
};

export default nextConfig;
