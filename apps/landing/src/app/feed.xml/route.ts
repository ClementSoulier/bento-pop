/**
 * Le flux RSS du podcast, à https://bento-pop.com/feed.xml.
 *
 * C'est l'adresse que lisent Apple Podcasts, Spotify et Deezer : **elle ne doit jamais
 * changer**. La déplacer obligerait à refaire une migration de flux, avec le risque de
 * perdre les abonnés.
 *
 * À la racine et non sous `/api/` : `robots.ts` interdit `/api/` aux robots.
 *
 * Le cache est volontairement court. Un épisode entre dans le flux à la seconde où sa
 * date de sortie audio est passée, sans tâche programmée : c'est ce calcul à la lecture
 * qui fait la publication automatique, et un cache long la retarderait d'autant.
 */
import { buildFeed } from '@/lib/podcast/feed';
import { getFeedEpisodes, getFeedSettings } from '@/lib/podcast/source';

export const dynamic = 'force-dynamic';

const FEED_PATH = '/feed.xml';

export async function GET(request: Request): Promise<Response> {
  const settings = await getFeedSettings();
  if (!settings) {
    // Base injoignable : une erreur franche vaut mieux qu'un flux vide, qu'une appli
    // d'écoute pourrait interpréter comme un podcast dont tous les épisodes ont disparu.
    return new Response('Flux indisponible', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    });
  }

  const base = settings.link.replace(/\/$/, '') || new URL(request.url).origin;
  const xml = buildFeed(settings, await getFeedEpisodes(), `${base}${FEED_PATH}`);

  return new Response(xml, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300',
    },
  });
}
