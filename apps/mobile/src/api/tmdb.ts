import Constants from 'expo-constants';
import type { SearchResult } from './types';

/**
 * Client TMDb (films + séries).
 *
 * Auth : v4 read access token (Bearer JWT), passé dans le header `Authorization`.
 * Scopé `api_read` — sûr à embarquer côté client pour un usage non-commercial.
 *
 * Doc : https://developer.themoviedb.org/reference/search-movie
 *       https://developer.themoviedb.org/reference/search-tv
 */

const BASE = 'https://api.themoviedb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p';
/** Taille poster : w500 = ratio 2:3 ~333×500, suffisant pour nos tiles. */
const POSTER_SIZE = 'w500';

function token(): string {
  const t = Constants.expoConfig?.extra?.TMDB_TOKEN as string | undefined;
  if (!t) throw new Error('Missing EXPO_PUBLIC_TMDB_TOKEN (set in apps/mobile/.env)');
  return t;
}

async function tmdbFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token()}`,
      accept: 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`TMDb ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

type TMDBMovie = {
  id: number;
  title: string;
  original_title?: string;
  release_date?: string;
  poster_path?: string | null;
  overview?: string;
  vote_average?: number;
};

type TMDBSearchResponse<T> = {
  page: number;
  results: T[];
  total_results: number;
};

/** Recherche films. */
export async function searchMovies(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  const data = await tmdbFetch<TMDBSearchResponse<TMDBMovie>>('/search/movie', {
    query: query.trim(),
    language: 'fr-FR',
    include_adult: 'false',
    page: '1',
  });
  return data.results.slice(0, 12).map(toMovieResult);
}

function toMovieResult(m: TMDBMovie): SearchResult {
  const year = m.release_date ? parseInt(m.release_date.slice(0, 4), 10) : undefined;
  return {
    externalId: String(m.id),
    source: 'tmdb',
    title: m.title || m.original_title || '?',
    subtitle: year ? String(year) : undefined,
    year,
    imageUrl: m.poster_path ? `${IMG_BASE}/${POSTER_SIZE}${m.poster_path}` : undefined,
    raw: { type: 'movie', ...m },
  };
}

type TMDBSeries = {
  id: number;
  name: string;
  original_name?: string;
  first_air_date?: string;
  poster_path?: string | null;
  overview?: string;
  vote_average?: number;
  origin_country?: string[];
};

/** Recherche séries. */
export async function searchSeries(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  const data = await tmdbFetch<TMDBSearchResponse<TMDBSeries>>('/search/tv', {
    query: query.trim(),
    language: 'fr-FR',
    include_adult: 'false',
    page: '1',
  });
  return data.results.slice(0, 12).map(toSeriesResult);
}

function toSeriesResult(s: TMDBSeries): SearchResult {
  const year = s.first_air_date ? parseInt(s.first_air_date.slice(0, 4), 10) : undefined;
  return {
    externalId: String(s.id),
    source: 'tmdb',
    title: s.name || s.original_name || '?',
    subtitle: year ? String(year) : undefined,
    year,
    imageUrl: s.poster_path ? `${IMG_BASE}/${POSTER_SIZE}${s.poster_path}` : undefined,
    raw: { type: 'series', ...s },
  };
}
