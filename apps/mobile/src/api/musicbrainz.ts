import type { SearchResult } from './types';

/**
 * Client MusicBrainz (artistes + chansons).
 *
 * Aucune authentification requise. User-Agent obligatoire (politesse).
 * Cover art via le service séparé coverartarchive.org.
 *
 * Doc : https://musicbrainz.org/doc/MusicBrainz_API/Search
 * Rate limit : 1 req/seconde — on respecte côté UI via debounce 400ms.
 */

const BASE = 'https://musicbrainz.org/ws/2';
const COVER_BASE = 'https://coverartarchive.org';
const USER_AGENT = 'BentoPop/0.1 (https://bento-pop.com)';

async function mbFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('fmt', 'json');
  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    },
  });
  if (!res.ok) throw new Error(`MusicBrainz ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

type MBArtist = {
  id: string;
  name: string;
  'sort-name'?: string;
  country?: string;
  disambiguation?: string;
  type?: string;
  'life-span'?: { begin?: string; end?: string };
};

/** Recherche artiste musical. */
export async function searchArtists(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  const data = await mbFetch<{ artists: MBArtist[] }>('/artist', {
    query: query.trim(),
    limit: '12',
  });
  return data.artists.map((a) => {
    const year = a['life-span']?.begin ? parseInt(a['life-span']!.begin!.slice(0, 4), 10) : undefined;
    const parts = [a.country, a.type, a.disambiguation].filter(Boolean);
    return {
      externalId: a.id,
      source: 'musicbrainz' as const,
      title: a.name,
      subtitle: parts.join(' · ') || undefined,
      year,
      imageUrl: undefined, // pas de photo d'artiste dans MB (légal)
      raw: { type: 'artist', ...a },
    };
  });
}

type MBRecording = {
  id: string;
  title: string;
  length?: number;
  'artist-credit'?: { name: string }[];
  releases?: { id: string; title: string; date?: string }[];
};

/**
 * Recherche chanson (recording). MusicBrainz distingue recording / release /
 * release-group. On utilise `recording` (= morceau enregistré). L'image
 * vient du release-group via coverartarchive.org.
 */
export async function searchTracks(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  const data = await mbFetch<{ recordings: MBRecording[] }>('/recording', {
    query: query.trim(),
    limit: '12',
  });
  return data.recordings.map((r) => {
    const artist = r['artist-credit']?.[0]?.name;
    const release = r.releases?.[0];
    const year = release?.date ? parseInt(release.date.slice(0, 4), 10) : undefined;
    return {
      externalId: r.id,
      source: 'musicbrainz' as const,
      title: r.title,
      subtitle: [artist, year].filter(Boolean).join(' · ') || undefined,
      year,
      // Cover art : on tente release-group du premier release (best effort).
      // Comme c'est une requête supplémentaire, on l'ajoute paresseusement
      // côté UI avec un Image fallback en cas de 404.
      imageUrl: release ? `${COVER_BASE}/release/${release.id}/front-250` : undefined,
      raw: { type: 'recording', artist, ...r },
    };
  });
}
