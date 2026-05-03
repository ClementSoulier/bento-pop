/**
 * Familles typographiques Bento Pop.
 *
 * - **Extenda 100 Yotta** : titre signature, gros impact (logo, CTA, reveal).
 *   Police custom OTF — chargée via `next/font/local` côté app, en pointant
 *   vers `@bento-pop/brand/assets/fonts/extenda-100-yotta.otf`.
 * - **Fredoka** : UI courante (boutons, étiquettes, corps de texte).
 *   Chargée via `next/font/google`.
 * - **Bungee** : fallback display si Extenda Yotta n'est pas dispo (Google).
 */

export const fontFamilies = {
  display: ['var(--font-extenda)', 'var(--font-bungee)', 'sans-serif'],
  body: ['var(--font-fredoka)', 'system-ui', 'sans-serif'],
} as const;

export const fontStacks = {
  display: fontFamilies.display.join(', '),
  body: fontFamilies.body.join(', '),
};
