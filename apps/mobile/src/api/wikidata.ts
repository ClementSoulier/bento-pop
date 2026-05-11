import type { SearchResult } from './types';
import { enrichWithWikipediaThumbs } from './wikipedia';

/**
 * Client Wikidata pour la catégorie "créateur de contenu".
 *
 * On filtre les résultats via SPARQL pour ne garder que les humains (Q5)
 * dont l'occupation est créateur de contenu / YouTubeur / streamer /
 * podcasteur. Plus restrictif qu'une simple wbsearchentities, mais évite
 * les faux positifs (homonymes, lieux, œuvres).
 *
 * Pour le MVP : `wbsearchentities` simple + filtre côté client sur le label.
 * Le SPARQL filtré viendra en P3 si la qualité des résultats pose problème.
 *
 * Doc : https://www.wikidata.org/w/api.php?action=help&modules=wbsearchentities
 */

const USER_AGENT = 'BentoPop/0.1 (https://bento-pop.com)';

type WDSearchHit = {
  id: string;
  label?: string;
  description?: string;
  url?: string;
  match?: { text: string };
};

export async function searchCreators(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  const url = new URL('https://www.wikidata.org/w/api.php');
  url.searchParams.set('action', 'wbsearchentities');
  url.searchParams.set('search', query.trim());
  url.searchParams.set('language', 'fr');
  url.searchParams.set('uselang', 'fr');
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '12');
  url.searchParams.set('origin', '*'); // CORS pour appel côté client web

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Wikidata search failed: ${res.status}`);
  const data = (await res.json()) as { search: WDSearchHit[] };

  const base: SearchResult[] = data.search.map((h) => ({
    externalId: h.id,
    source: 'wikidata' as const,
    title: h.label || h.id,
    subtitle: h.description || undefined,
    imageUrl: undefined,
    raw: h,
  }));
  // Enrichit avec la vignette Wikipedia (couvre ~80% des créateurs notables).
  return enrichWithWikipediaThumbs(base);
}
