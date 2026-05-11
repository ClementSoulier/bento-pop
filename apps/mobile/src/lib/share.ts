import { Platform, Share } from 'react-native';

/**
 * Partage d'un bento via le share natif de la plateforme.
 *
 * MVP : on partage uniquement l'URL publique (texte + lien). La génération
 * d'une image PNG façon story Instagram viendra en P3.x avec
 * `react-native-view-shot` + `expo-sharing.shareAsync(localUri)`.
 *
 * Web : utilise Web Share API si dispo (mobile Safari, Chrome Android),
 *       sinon fallback navigator.clipboard.writeText + return 'copied'.
 * Native : Share.share natif iOS/Android.
 */

const SITE = 'https://bento-pop.com';

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'unsupported';

export async function shareBento(pseudo: string): Promise<ShareOutcome> {
  const url = `${SITE}/u/${pseudo}`;
  const title = `Mon Bento Pop · @${pseudo}`;
  const message = `Mon Bento Pop @${pseudo} 🍱\n${url}`;

  if (Platform.OS === 'web') {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    if (nav?.share) {
      try {
        await nav.share({ title, text: message, url });
        return 'shared';
      } catch (e) {
        // L'utilisateur a annulé — pas une vraie erreur.
        if ((e as { name?: string }).name === 'AbortError') return 'cancelled';
        return 'cancelled';
      }
    }
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(url);
      return 'copied';
    }
    return 'unsupported';
  }

  try {
    const res = await Share.share({ title, message, url });
    return res.action === Share.dismissedAction ? 'cancelled' : 'shared';
  } catch {
    return 'unsupported';
  }
}
