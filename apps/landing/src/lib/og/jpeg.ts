import sharp from 'sharp';

/**
 * Ré-encodage JPEG de l'image Open Graph.
 *
 * Séparé de `encode.ts`, qui construit la `Response` et porte
 * `server-only` : cette fonction-ci doit rester importable par le runner
 * de tests, parce que c'est elle qui garantit le budget de poids.
 *
 * `ImageResponse` ne sait produire que du PNG. Sur une image de 1200×630
 * comportant six photographies, le PNG mesuré fait 377 Ko, or **WhatsApp
 * n'affiche pas d'aperçu au-delà d'environ 300 Ko**, et c'est le premier
 * canal de partage visé. Un PNG hors budget, c'est un lien nu dans la
 * conversation : exactement le problème que ce chantier corrige.
 *
 * Le contenu est photographique et le fond opaque : le JPEG est le format
 * adapté, sans perte visible à qualité 82.
 */

/**
 * Paliers de qualité, du meilleur au plus économe.
 *
 * On ne se contente pas d'espérer que 82 suffise : la contrainte vient
 * d'une plateforme tierce, donc le code doit la **garantir**. Mesuré sur
 * un bento réel richement illustré, le premier palier donne 68 Ko, soit un
 * cinquième du budget ; les suivants ne servent que dans des cas
 * pathologiques, où une image un peu moins fine vaut mieux que pas
 * d'aperçu du tout.
 */
export const QUALITY_LADDER = [82, 68, 55, 42] as const;

/** Budget de poids, en octets. Seuil d'affichage d'aperçu de WhatsApp. */
export const OG_MAX_BYTES = 300 * 1024;

function encodeAt(png: Buffer, quality: number): Promise<Buffer> {
  return sharp(png).jpeg({ quality, mozjpeg: true, progressive: true }).toBuffer();
}

/**
 * Encode au meilleur palier qui tient dans le budget.
 *
 * En pratique une seule passe : on ne descend d'un cran que si la
 * précédente dépasse, ce qui n'arrive pas sur les images réelles.
 */
export async function encodeJpeg(png: Buffer): Promise<Buffer> {
  // Le premier palier est traité hors boucle : le tableau est un tuple, son
  // premier élément existe donc de façon certaine et `smallest` n'a jamais
  // besoin d'être nullable.
  let smallest = await encodeAt(png, QUALITY_LADDER[0]);
  if (smallest.byteLength <= OG_MAX_BYTES) return smallest;

  for (const quality of QUALITY_LADDER.slice(1)) {
    const jpeg = await encodeAt(png, quality);
    if (jpeg.byteLength <= OG_MAX_BYTES) return jpeg;
    if (jpeg.byteLength < smallest.byteLength) smallest = jpeg;
  }

  // Aucun palier ne suffit : on renvoie le plus léger obtenu plutôt que
  // rien. Ne devrait pas se produire sur une image de 1200×630 dont plus
  // de la moitié est un aplat de couleur.
  console.warn('[og] budget de poids non tenu même au palier le plus bas');
  return smallest;
}
