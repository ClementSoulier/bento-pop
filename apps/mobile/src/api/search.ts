import type { CategoryKey } from '@/supabase/types';
import { searchMovies, searchSeries } from './tmdb';
import { searchArtists, searchTracks } from './musicbrainz';
import { searchCreators } from './wikidata';
import { searchPlaces } from './osm';
import type { SearchResult } from './types';

/**
 * Aiguillage catégorie → bonne API externe.
 * Centralisé ici pour que la modal de recherche reste agnostique.
 */
export async function searchByCategory(
  category: CategoryKey,
  query: string,
): Promise<SearchResult[]> {
  switch (category) {
    case 'film':
      return searchMovies(query);
    case 'series':
      return searchSeries(query);
    case 'artist':
      return searchArtists(query);
    case 'track':
      return searchTracks(query);
    case 'creator':
      return searchCreators(query);
    case 'place':
      return searchPlaces(query);
  }
}
