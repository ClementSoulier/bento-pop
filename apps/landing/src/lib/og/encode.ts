import 'server-only';
import type { ImageResponse } from 'next/og';
import { encodeJpeg } from './jpeg';

/**
 * Construction de la réponse HTTP de l'image Open Graph.
 *
 * L'encodage lui-même vit dans `jpeg.ts`, testable ; ce module ajoute les
 * en-têtes et le repli. En cas d'échec de l'encodage on renvoie le PNG
 * d'origine plutôt que rien : un aperçu trop lourd vaut mieux qu'une
 * absence d'aperçu.
 */

/** Durée de cache annoncée aux robots d'aperçu et aux intermédiaires. */
const CACHE_CONTROL = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800';

export const OG_CONTENT_TYPE = 'image/jpeg';

export async function toJpegResponse(image: ImageResponse): Promise<Response> {
  const png = Buffer.from(await image.arrayBuffer());

  try {
    const jpeg = await encodeJpeg(png);

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
