import type { MetadataRoute } from 'next';

/**
 * Web App Manifest pour la PWA Bento Pop.
 *
 * Les icônes pointent sur les URLs générées par `icon.tsx` via
 * `generateImageMetadata` (un fichier, plusieurs tailles à `/icon/<id>`).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Bento Pop',
    short_name: 'Bento Pop',
    description:
      'Le Talk-Show Pop Culture qui parcourt la France. Cinéma, gaming, mangas et débats de société.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'fr',
    background_color: '#fbbf24',
    theme_color: '#fbbf24',
    categories: ['entertainment'],
    icons: [
      {
        src: '/icon/192',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon/512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon/maskable',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
