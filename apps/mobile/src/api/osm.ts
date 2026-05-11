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
  url.searchParams.set('limit', '12');
  // On veut surtout des villes / pays / régions, pas des restaurants
  url.searchParams.set('featuretype', 'city');

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Nominatim search failed: ${res.status}`);
  const data = (await res.json()) as NominatimHit[];

  return data
    .filter((h) => h.class === 'boundary' || h.class === 'place')
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
        imageUrl: undefined, // OSM n'a pas de photos ; P3 → on tirera depuis Commons via le QID Wikidata si présent
        raw: h,
      };
    });
}
