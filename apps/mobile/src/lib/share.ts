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

/**
 * Adresse publique d'un bento, sous sa forme canonique.
 *
 * En minuscules : c'est la forme canonique côté web, où toute autre casse
 * déclenche une redirection 308. Partager directement la bonne évite un
 * aller-retour, et surtout évite qu'un aperçu de messagerie doive suivre
 * une redirection — certains robots ne le font pas et n'affichent alors
 * aucun aperçu.
 *
 * L'unicité étant posée en base sur `lower(pseudo)`, la minuscule désigne
 * sans ambiguïté la même personne.
 */
export function publicBentoUrl(
  pseudo: string,
  slug?: string | null,
  isPrimary = true,
): string {
  const compte = `${SITE}/u/${pseudo.trim().toLowerCase()}`;
  // Le principal se partage à l'adresse du compte, comme avant le chantier
  // 16 : c'est elle qui circule déjà, et c'est elle que la landing donne
  // pour canonique.
  return isPrimary || !slug ? compte : `${compte}/${slug}`;
}

/** Idem sans le protocole, pour l'afficher sur l'image de partage. */
export function publicBentoLabel(
  pseudo: string,
  slug?: string | null,
  isPrimary = true,
): string {
  return publicBentoUrl(pseudo, slug, isPrimary).replace(/^https:\/\//, '');
}

export async function shareBento(
  pseudo: string,
  slug?: string | null,
  isPrimary = true,
): Promise<ShareOutcome> {
  const url = publicBentoUrl(pseudo, slug, isPrimary);
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
