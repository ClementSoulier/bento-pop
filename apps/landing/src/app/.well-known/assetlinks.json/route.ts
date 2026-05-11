import { NextResponse } from 'next/server';

// `force-dynamic` : lit ANDROID_SHA256_FINGERPRINT à chaque requête,
// pour pouvoir provisionner la var côté hébergeur sans redéployer.
export const dynamic = 'force-dynamic';

/**
 * Digital Asset Links — Android App Links.
 *
 * Servi à `https://bento-pop.com/.well-known/assetlinks.json`. Le fingerprint
 * SHA-256 vient de la signing key de l'app Android (visible via EAS Build
 * une fois le 1er build production fait, ou via Play Console).
 *
 * Tant que `ANDROID_SHA256_FINGERPRINT` n'est pas défini, on retourne un
 * tableau vide (file valide, ne casse rien, mais pas de routing actif).
 */
export function GET() {
  const sha256 = process.env.ANDROID_SHA256_FINGERPRINT;
  const body = sha256
    ? [
        {
          relation: ['delegate_permission/common.handle_all_urls'],
          target: {
            namespace: 'android_app',
            package_name: 'com.bentopop.mobile',
            sha256_cert_fingerprints: [sha256],
          },
        },
      ]
    : [];

  return NextResponse.json(body, {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=300',
    },
  });
}
