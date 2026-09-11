/**
 * Liens de téléchargement de « Mon Bento Pop » et lien profond.
 *
 * Les identifiants sont ceux déjà utilisés par l'app pour son écran de mise
 * à jour forcée (`apps/mobile/src/components/AppBlocker.tsx:15`).
 */

export const IOS_APP_ID = '6768764158';
export const ANDROID_PACKAGE = 'com.bentopop.mobile';

export const APP_STORE_URL = `https://apps.apple.com/app/id${IOS_APP_ID}`;
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;

/**
 * Lien profond vers le bento dans l'app installée.
 *
 * Utile parce que les navigateurs intégrés (Instagram, Messenger, Discord)
 * n'honorent pas toujours les liens universels : un visiteur qui a pourtant
 * l'app peut se retrouver sur cette page web. Sans ce lien, il n'aurait
 * aucun moyen d'en sortir vers l'app.
 *
 * Le schéma `bentopop` est déclaré dans `apps/mobile/app.json`, et la route
 * `/u/[pseudo]` existe côté Expo Router.
 */
export function appDeepLink(pseudo: string): string {
  return `bentopop://u/${encodeURIComponent(pseudo)}`;
}

/**
 * Contenu de la bannière Smart App d'iOS.
 *
 * Safari l'affiche nativement en haut de page, gratuitement, et gère
 * lui-même « Ouvrir » ou « Obtenir » selon que l'app est installée. C'est
 * la façon la plus propre de traiter le cas iOS sans détecter le
 * `user-agent`, ce qui rendrait la page dynamique et coûterait l'ISR.
 */
export function smartAppBanner(canonicalUrl: string): string {
  return `app-id=${IOS_APP_ID}, app-argument=${canonicalUrl}`;
}
