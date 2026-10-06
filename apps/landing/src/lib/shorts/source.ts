/**
 * Va chercher les shorts « Mon Bento Pop » sur YouTube.
 *
 * Flux RSS public de la playlist : ni clé ni quota. Mis en cache une heure
 * côté serveur, pour qu'un pic de visites ne devienne pas un pic d'appels à
 * YouTube et qu'un nouveau short apparaisse dans l'heure.
 */
import { unstable_cache } from 'next/cache';

import { parseShortsFeed, type GuestShort } from './feed';

/** Playlist publique « Mon Bento Pop » de la chaîne. */
export const GUEST_SHORTS_PLAYLIST_ID = 'PLKE8Rktu9_iU';

export const GUEST_SHORTS_PLAYLIST_URL = `https://www.youtube.com/playlist?list=${GUEST_SHORTS_PLAYLIST_ID}`;

const FEED_URL = `https://www.youtube.com/feeds/videos.xml?playlist_id=${GUEST_SHORTS_PLAYLIST_ID}`;

const FEED_TIMEOUT_MS = 4000;

/**
 * Lève sur tout échec : `unstable_cache` ne garde pas une erreur, donc une
 * panne passagère de YouTube n'efface pas la section pendant une heure.
 */
const fetchGuestShorts = unstable_cache(
  async (): Promise<GuestShort[]> => {
    const res = await fetch(FEED_URL, {
      signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Flux des shorts : HTTP ${res.status}`);
    const shorts = parseShortsFeed(await res.text());
    if (shorts.length === 0) throw new Error('Flux des shorts vide');
    return shorts;
  },
  ['guest-shorts', GUEST_SHORTS_PLAYLIST_ID],
  { revalidate: 3600 },
);

export async function getGuestShorts(): Promise<GuestShort[]> {
  try {
    return await fetchGuestShorts();
  } catch {
    return [];
  }
}
