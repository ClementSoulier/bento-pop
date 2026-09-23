import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@bento-pop/brand', '@bento-pop/ui'],
  // Le SDK d'Expo 6.1.0 relit son `package.json` à chaque envoi, par un
  // `createRequire` que webpack ne suit pas : empaqueté, il le cherche à un
  // chemin absent de l'image autonome, et tous les envois échouent. Hors du
  // paquet, il est copié tel quel avec son `package.json`. Mesuré le 23
  // septembre 2026 sur l'image Docker (chantier 17, lot 3) ; corrigé dans la
  // 7.0.0 du SDK, qui exige Node 22.
  serverExternalPackages: ['expo-server-sdk'],
  outputFileTracingRoot: path.join(process.cwd(), '../..'),
  output: 'standalone',
  reactStrictMode: true,
};

export default nextConfig;
