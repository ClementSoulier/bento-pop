/**
 * Forme canonique d'un résultat de recherche, normalisée à travers toutes
 * les APIs externes (TMDb, MusicBrainz, Wikidata, OSM). Permet à la modal
 * de recherche d'afficher uniformément sans switch par source.
 */
export type SearchResult = {
  /** ID externe brut, sert de dedup key avec `source`. */
  externalId: string;
  /** Source d'origine, identique à `items.external_source` côté BDD. */
  source: 'tmdb' | 'musicbrainz' | 'wikidata' | 'osm';
  title: string;
  /** Ligne secondaire (année + réal, artiste, pays, etc.). */
  subtitle?: string;
  year?: number;
  /** URL HTTPS d'une image (poster TMDb, cover MusicBrainz, etc.). */
  imageUrl?: string;
  /** Payload brut pour debug / extension future. Sera stocké en `items.metadata`. */
  raw?: Record<string, unknown>;
};
