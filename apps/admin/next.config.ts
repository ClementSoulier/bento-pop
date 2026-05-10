import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@bento-pop/brand', '@bento-pop/ui'],
  outputFileTracingRoot: path.join(process.cwd(), '../..'),
  output: 'standalone',
  reactStrictMode: true,
};

export default nextConfig;
