import { NextResponse, type NextRequest } from 'next/server';
import { recordWebVisit } from '@/lib/bento/visits';
import { createMobileAnonClient } from '@/lib/supabase/mobile';

/**
 * Une page de bento ouverte dans un navigateur, chantier 8.
 *
 * Appelée par l'image d'un pixel que rend `VisitBeacon`, `?b=<id du bento>`
 * et `&d=<jour>`. Le jour n'est là que pour le cache de Safari, cf.
 * `beaconDay` : la route ne le lit pas.
 * La visite se compte dans le Supabase mobile par `record_bento_visit_web`,
 * avec le secret `BENTO_VISIT_SECRET` : la clé anonyme, publique dans chaque
 * copie de l'app, ne suffit pas à gonfler un compteur (D15).
 *
 * La réponse est toujours la même image, que la visite compte ou non : une
 * image en erreur se verrait dans la console du visiteur, et ne lui dirait
 * rien. Ce qu'il est advenu de la visite part dans `X-Bento-Visit`.
 *
 * `BENTO_VISIT_SECRET` est une variable **serveur**, lue à chaque requête :
 * dans Coolify, sur l'app landing, au runtime. Absente, rien ne compte et
 * la page s'affiche comme avant.
 */
export const dynamic = 'force-dynamic';

/** GIF transparent de 1 × 1, 43 octets. */
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

export async function GET(request: NextRequest) {
  const outcome = await recordWebVisit({
    bentoId: request.nextUrl.searchParams.get('b'),
    headers: request.headers,
    secret: process.env.BENTO_VISIT_SECRET,
    client: createMobileAnonClient(),
  });

  return new NextResponse(PIXEL, {
    headers: {
      'Content-Type': 'image/gif',
      // Une image servie du cache ne compterait pas la visite suivante.
      'Cache-Control': 'no-store, max-age=0',
      'X-Bento-Visit': outcome,
      'X-Robots-Tag': 'noindex',
    },
  });
}
