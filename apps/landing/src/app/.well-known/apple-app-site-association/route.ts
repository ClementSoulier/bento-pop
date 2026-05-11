import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

/**
 * Apple App Site Association (AASA) — Universal Links iOS.
 *
 * Servi à `https://bento-pop.com/.well-known/apple-app-site-association`
 * SANS extension `.json`, avec content-type `application/json`. Le file
 * est fetché par iOS au moment de l'install de l'app pour autoriser
 * `https://bento-pop.com/u/*` à ouvrir l'app au lieu du navigateur.
 *
 * Format docs : https://developer.apple.com/documentation/xcode/supporting-associated-domains
 *
 * Le `<TEAM_ID>` Apple est l'identifiant du Apple Developer Account
 * (10 caractères alphanumériques). À renseigner via env var quand le
 * compte est OK — sinon on retourne un AASA "vide" valide qui ne casse
 * rien mais ne permet pas de routing.
 */
export function GET() {
  const teamId = process.env.APPLE_TEAM_ID;
  const bundleId = 'com.bentopop.mobile';
  const appId = teamId ? `${teamId}.${bundleId}` : null;

  const body = appId
    ? {
        applinks: {
          apps: [],
          details: [
            {
              appID: appId,
              paths: ['/u/*'],
            },
          ],
        },
      }
    : { applinks: { apps: [], details: [] } };

  return NextResponse.json(body, {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=300',
    },
  });
}
