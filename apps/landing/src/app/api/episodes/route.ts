import { NextResponse } from 'next/server';
import { getApiEpisodeRows } from '@/content/episodes';
import { toApiEpisodes } from '@/lib/episodes-api';

/**
 * Les épisodes publiés, émissions et podcasts, pour « La table » de l'app.
 * Chantier 19, cf. `docs/UX-19-EPISODES-LA-TABLE.md` §6.1.
 *
 * Calculée à chaque lecture, comme `feed.xml` : un épisode programmé entre
 * dans la réponse à la minute où sa date passe, sans tâche programmée ni
 * purge du back-office (D10). D'où une minute de cache, et pas davantage.
 *
 * Publique et sans jeton : elle ne rend que ce que les pages `/emissions` et
 * `/podcasts` montrent déjà, et seulement les champs de la carte (D11).
 * `robots.ts` ferme déjà `/api/` aux moteurs.
 *
 * La base injoignable, elle répond 503 sans cache, comme `feed.xml` : l'app
 * affiche alors son fil sans épisode (D9), et le redemande à la prochaine
 * ouverture.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const rows = await getApiEpisodeRows();
  if (!rows) {
    return NextResponse.json(
      { error: 'Épisodes indisponibles' },
      { status: 503, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
    );
  }

  // Le site lui-même, pour un épisode que sa plateforme n'a pas encore repris
  // (D13) : la même adresse que la page du podcast.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bento-pop.com';
  return NextResponse.json(
    { episodes: toApiEpisodes(rows, Date.now(), siteUrl) },
    {
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300',
        'X-Robots-Tag': 'noindex',
      },
    },
  );
}
