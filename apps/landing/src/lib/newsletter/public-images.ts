/**
 * Les images à adresse fixe des newsletters, servies depuis
 * `apps/landing/public/newsletter/` sous `https://bento-pop.com/newsletter/`.
 *
 * Un mail charge ses images depuis internet à chaque ouverture, des mois après
 * son envoi : **ces fichiers ne se renomment ni ne se suppriment jamais**. On
 * peut en ajouter, ou remplacer une image par une autre de même nom. Les tests
 * vérifient que chacune est là (unitaire) et servie (e2e).
 */
export const NEWSLETTER_PUBLIC_IMAGES = [
  { path: '/newsletter/logo-bento-pop.png', width: 640 },
  { path: '/newsletter/popy-content.png', width: 400 },
  { path: '/newsletter/popy-nani.png', width: 400 },
  { path: '/newsletter/popy-gene.png', width: 400 },
  { path: '/newsletter/popy-intello.png', width: 400 },
  { path: '/newsletter/popy-diable.png', width: 400 },
  { path: '/newsletter/icones/youtube.png', width: 96 },
  { path: '/newsletter/icones/instagram.png', width: 96 },
  { path: '/newsletter/icones/tiktok.png', width: 96 },
  { path: '/newsletter/icones/twitch.png', width: 96 },
  { path: '/newsletter/icones/x.png', width: 96 },
  { path: '/newsletter/icones/site.png', width: 96 },
] as const;

/** Largeur lue dans l'en-tête IHDR d'un PNG, `null` si ce n'en est pas un. */
export function pngWidth(bytes: Uint8Array): number | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || signature.some((b, i) => bytes[i] !== b)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getUint32(16);
}
