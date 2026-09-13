import { Linking, Platform } from 'react-native';

/**
 * Ouvre la fiche de l'app sur le store de la plateforme.
 *
 * Extrait de `AppBlocker.tsx` : les deux mécanismes de mise à jour, le
 * blocage dur et l'invitation douce, envoient au même endroit et ne doivent
 * pas diverger.
 */

const IOS_APP_ID = '6768764158';
const ANDROID_PACKAGE = 'com.bentopop.mobile';

export function openStore() {
  if (Platform.OS === 'ios') {
    // Schéma natif iOS : ouvre directement l'App Store app sur la fiche.
    // Fallback HTTPS si pour une raison X le schéma n'est pas géré.
    const deepLink = `itms-apps://apps.apple.com/app/id${IOS_APP_ID}`;
    const webLink = `https://apps.apple.com/app/id${IOS_APP_ID}`;
    Linking.openURL(deepLink).catch(() => {
      void Linking.openURL(webLink).catch(() => {});
    });
    return;
  }
  const deepLink = `market://details?id=${ANDROID_PACKAGE}`;
  const webLink = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
  Linking.openURL(deepLink).catch(() => {
    void Linking.openURL(webLink).catch(() => {});
  });
}
