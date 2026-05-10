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
};

export default nextConfig;
