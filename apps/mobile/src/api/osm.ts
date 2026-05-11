import type { SearchResult } from './types';

/**
 * Client Nominatim (OpenStreetMap) pour les lieux de voyage.
 *
 * Pas d'auth requise. User-Agent obligatoire (politesse OSM).
 * Rate limit : 1 req/seconde — debounce 400ms côté UI.
 *
 * Doc : https://nominatim.org/release-docs/latest/api/Search/
 */

const BASE = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'BentoPop/0.1 (https://bento-pop.com)';

/**
 * Types de lieux pertinents pour un « lieu de voyage ». Nominatim renvoie
 * un `type` granulaire (city, town, village, country, state, region…).
 * On garde les niveaux pertinents et on ignore les rues, bâtiments, POI.
 */
const RELEVANT_TYPES: ReadonlySet<string> = new Set([
  'country',
  'state',
  'region',
  'province',
  'county',
  'city',
  'town',
  'village',
  'hamlet',
  'island',
  'municipality',
  'administrative',
  'capital',
  'archipelago',
]);

type NominatimHit = {
  place_id: number;
  osm_id: number;
  osm_type: string;
  display_name: string;
  name?: string;
  type?: string;
  class?: string;
  lat?: string;
  lon?: string;
  addresstype?: string;
  importance?: number;
};

export async function searchPlaces(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  const url = new URL(BASE);
  url.searchParams.set('q', query.trim());
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('accept-language', 'fr');
  url.searchParams.set('limit', '20');
  // Pas de `featuretype=city` : trop restrictif, exclut « Angers »
  // (matché OSM `place=city` mais pas comme « city » au sens du filtre
  // Nominatim qui s'attend à un addresstype particulier).

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Nominatim search failed: ${res.status}`);
  const data = (await res.json()) as NominatimHit[];

  // Pas d'image au moment de la recherche : on enrichira Wikipedia à la
  // sélection (cf. search-modal `onConfirm`) pour ne pas faire 12 fetches.
  return data
    .filter((h) => {
      // On garde si le type OU l'addresstype matche un niveau pertinent.
      const t = h.type ?? '';
      const at = h.addresstype ?? '';
      return RELEVANT_TYPES.has(t) || RELEVANT_TYPES.has(at);
    })
    .sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0))
    .slice(0, 12)
    .map((h) => {
      const parts = h.display_name.split(',').map((s) => s.trim());
      const title = h.name || parts[0] || 'Lieu';
      const country = parts[parts.length - 1];
      const subtitle = country && country !== title ? country : undefined;
      return {
        externalId: `${h.osm_type}/${h.osm_id}`,
        source: 'osm' as const,
        title,
        subtitle,
        imageUrl: undefined,
        raw: h,
      };
    });
}
