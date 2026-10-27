import {
  SOCIAL_LABELS,
  SOCIAL_NETWORKS,
  handleFromInput,
  isValidHandle,
  socialProfileUrl,
  type SocialNetworkName,
} from '@bento-pop/supabase-mobile/bento';
import type { SocialLinksRow } from '@/supabase/types';

/**
 * Les comptes Instagram et TikTok, chantier 25 : de la saisie au lien. La
 * base normalise, vérifie et filtre (§4) ; ici, ce que l'écran en dit avant
 * d'envoyer, les messages de ses refus, et ce que lit le lecteur d'écran.
 */

export { SOCIAL_LABELS, SOCIAL_NETWORKS, socialProfileUrl, type SocialNetworkName };

/** Les liens d'un compte, prêts pour l'écran : un réseau absent est `null`. */
export type SocialLinks = { instagram: string | null; tiktok: string | null; visible: boolean };

export function toSocialLinks(row: SocialLinksRow | null | undefined): SocialLinks | null {
  if (!row) return null;
  return { instagram: row.instagram ?? null, tiktok: row.tiktok ?? null, visible: row.visible };
}

/** Les réseaux qu'une page montre, dans l'ordre : ceux qui ont un lien, s'il est montré (D2, D3). */
export function shownNetworks(links: SocialLinks | null): { network: SocialNetworkName; handle: string }[] {
  if (!links || !links.visible) return [];
  return SOCIAL_NETWORKS.flatMap((network) => {
    const handle = links[network];
    return handle ? [{ network, handle }] : [];
  });
}

/** Ce qu'un champ envoie, ou pourquoi il refuse d'envoyer (D4). */
export type HandleInput = { ok: true; handle: string | null } | { ok: false; message: string };

/** Lit un champ : vide, il délie ; sinon, un pseudo au format du réseau. */
export function readHandleInput(network: SocialNetworkName, input: string): HandleInput {
  const handle = handleFromInput(network, input);
  if (handle === null) return { ok: true, handle: null };
  if (!isValidHandle(network, handle)) return { ok: false, message: invalidMessage(network) };
  return { ok: true, handle };
}

function invalidMessage(network: SocialNetworkName): string {
  return `Ce n'est pas un pseudo ${SOCIAL_LABELS[network]}.`;
}

/** Le champ qu'un refus de la base vise, et ce qu'on y lit (§3). */
export function socialErrorFor(error: unknown): { network: SocialNetworkName | null; message: string } {
  const key = error instanceof Error ? error.message : String(error ?? '');
  if (key.includes('social_invalid_instagram')) return { network: 'instagram', message: invalidMessage('instagram') };
  if (key.includes('social_invalid_tiktok')) return { network: 'tiktok', message: invalidMessage('tiktok') };
  if (key.includes('social_filtered_instagram')) return { network: 'instagram', message: "Ce pseudo n'est pas accepté." };
  if (key.includes('social_filtered_tiktok')) return { network: 'tiktok', message: "Ce pseudo n'est pas accepté." };
  if (key.includes('social_needs_profile')) {
    return { network: null, message: 'Publie ton bento pour relier tes réseaux.' };
  }
  if (key.includes('social_closed')) return { network: null, message: 'Les réseaux sont fermés pour le moment.' };
  return { network: null, message: "On n'a pas pu enregistrer tes réseaux. Vérifie ta connexion et réessaie." };
}

/** Ce que lit le lecteur d'écran sur un glyphe (D12). */
export function socialLinkLabel(network: SocialNetworkName, owner: string, handle: string): string {
  return `${SOCIAL_LABELS[network]} de @${owner} : @${handle}`;
}

export function socialLinkHint(network: SocialNetworkName): string {
  return `Ouvre ${SOCIAL_LABELS[network]}`;
}
