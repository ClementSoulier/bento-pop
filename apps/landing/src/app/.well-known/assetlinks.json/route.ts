import { NextResponse } from 'next/server';

// `force-dynamic` : lit ANDROID_SHA256_FINGERPRINT à chaque requête,
// pour pouvoir provisionner la var côté hébergeur sans redéployer.
export const dynamic = 'force-dynamic';

/**
 * Digital Asset Links — Android App Links.
 *
 * Servi à `https://bento-pop.com/.well-known/assetlinks.json`. Permet à
 * Android d'ouvrir l'app sur `bento-pop.com/u/*` au lieu du navigateur.
 *
 * **Plusieurs empreintes sont attendues, séparées par des virgules.** Une
 * app distribuée par le Play Store est signée par deux clés différentes
 * selon le canal :
 *
 *   - la clé d'upload, gérée par EAS, qui signe les builds internes et
 *     les APK installés hors magasin (`eas credentials`) ;
 *   - la clé de signature d'application, détenue par Google, qui re-signe
 *     ce que les utilisateurs téléchargent depuis le Play Store
 *     (Play Console → Intégrité de l'app).
 *
 * Ne déclarer que la première est l'erreur classique : les liens
 * fonctionnent sur les builds de test et retombent sur le navigateur pour
 * tout le monde une fois l'app publiée.
 *
 * Tant que `ANDROID_SHA256_FINGERPRINT` n'est pas défini, on retourne un
 * tableau vide : fichier valide, rien de cassé, simplement pas de routing.
 */
export function GET() {
  const fingerprints = (process.env.ANDROID_SHA256_FINGERPRINT ?? '')
    .split(',')
    .map((value) => value.trim().toUpperCase())
    // Format attendu : 32 octets en hexadécimal séparés par des deux-points,
    // exactement ce que copient EAS et la Play Console. On filtre le reste
    // plutôt que de servir un fichier qu'Android rejettera en silence.
    .filter((value) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(value));

  const body =
    fingerprints.length > 0
      ? [
          {
            relation: ['delegate_permission/common.handle_all_urls'],
            target: {
              namespace: 'android_app',
              package_name: 'com.bentopop.mobile',
              sha256_cert_fingerprints: fingerprints,
            },
          },
        ]
      : [];

  return NextResponse.json(body, {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  });
}
