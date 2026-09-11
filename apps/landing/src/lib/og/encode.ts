import 'server-only';
import sharp from 'sharp';
import type { ImageResponse } from 'next/og';

/**
 * Ré-encodage de l'image Open Graph en JPEG.
 *
 * `ImageResponse` ne sait produire que du PNG. Sur une image de 1200×630
 * comportant six photographies, le PNG mesuré fait 377 Ko, or **WhatsApp
 * n'affiche pas d'aperçu au-delà d'environ 300 Ko**, et c'est le premier
 * canal de partage visé. Un PNG hors budget, c'est un lien nu dans la
 * conversation : exactement le problème que ce chantier corrige.
 *
 * Le contenu est photographique et le fond opaque : le JPEG est le format
 * adapté, sans perte visible à qualité 82. `sharp` est déjà une dépendance
 * de la landing, utilisée par l'optimiseur `next/image`.
 *
 * En cas d'échec de l'encodage, on renvoie le PNG d'origine plutôt que
 * rien : un aperçu trop lourd vaut mieux qu'une absence d'aperçu.
 */

/** Qualité JPEG. 82 tient largement sous le budget sans artefact visible. */
const JPEG_QUALITY = 82;

/** Durée de cache annoncée aux robots d'aperçu et aux intermédiaires. */
const CACHE_CONTROL = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800';

export const OG_CONTENT_TYPE = 'image/jpeg';

export async function toJpegResponse(image: ImageResponse): Promise<Response> {
  const png = Buffer.from(await image.arrayBuffer());

  try {
    const jpeg = await sharp(png)
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true, progressive: true })
      .toBuffer();

    return new Response(new Uint8Array(jpeg), {
      headers: {
        'Content-Type': OG_CONTENT_TYPE,
        'Content-Length': String(jpeg.byteLength),
        'Cache-Control': CACHE_CONTROL,
      },
    });
  } catch (error) {
    console.error('[og] encodage JPEG échoué, PNG servi tel quel:', error);
    return new Response(new Uint8Array(png), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': CACHE_CONTROL },
    });
  }
}
