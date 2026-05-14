import { cache } from 'react';
import { createAnonServerClient } from '@/lib/supabase/server';

export type EpisodeGuest = {
  name: string;
  role?: string;
  photo_url?: string;
};

export type EpisodeMentionType = 'game' | 'movie' | 'series' | 'book' | 'other';

export type EpisodeMention = {
  type: EpisodeMentionType;
  title: string;
  url?: string;
  cover_url?: string;
};

export type EpisodeChapter = {
  label: string;
  start_seconds: number;
};

export type EpisodeHostPhoto =
  | { kind: 'image'; url: string; initials: string }
  | { kind: 'gradient'; from: string; to: string; initials: string };

export type EpisodeHost = {
  id: string;
  name: string;
  nick: string;
  initials: string;
  photo: EpisodeHostPhoto;
};

export type ShowEpisode = {
  id: string;
  slug: string;
  title: string;
  description: string;
  youtubeId: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  publishedAt: string | null;
  season: number;
  episodeNumber: number | null;
  displayOrder: number;
  seoTitle: string | null;
  seoDescription: string | null;
  guests: EpisodeGuest[];
  mentions: EpisodeMention[];
  chapters: EpisodeChapter[];
  hosts: EpisodeHost[];
};

export type PodcastEpisode = Omit<ShowEpisode, 'youtubeId'> & {
  spotifyEpisodeId: string;
};

const SHOW_SELECT =
  'id, slug, title, description, youtube_id, thumbnail_url, duration_seconds, published_at, season, episode_number, display_order, seo_title, seo_description, guests, mentions, chapters, landing_show_episode_hosts(display_order, landing_team(id, name, nick, initials, photo_kind, photo_from, photo_to, photo_url))';

const PODCAST_SELECT =
  'id, slug, title, description, spotify_episode_id, thumbnail_url, duration_seconds, published_at, season, episode_number, display_order, seo_title, seo_description, guests, mentions, chapters, landing_podcast_episode_hosts(display_order, landing_team(id, name, nick, initials, photo_kind, photo_from, photo_to, photo_url))';

type DbTeamMember = {
  id: string;
  name: string;
  nick: string;
  initials: string;
  photo_kind: 'gradient' | 'image';
  photo_from: string | null;
  photo_to: string | null;
  photo_url: string | null;
};

type DbHostJoin<K extends string> = Record<
  K,
  Array<{
    display_order: number;
    landing_team: DbTeamMember | DbTeamMember[] | null;
  }>
>;

type DbShowRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  youtube_id: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  published_at: string | null;
  season: number;
  episode_number: number | null;
  display_order: number;
  seo_title: string | null;
  seo_description: string | null;
  guests: EpisodeGuest[] | null;
  mentions: EpisodeMention[] | null;
  chapters: EpisodeChapter[] | null;
} & DbHostJoin<'landing_show_episode_hosts'>;

type DbPodcastRow = Omit<DbShowRow, 'youtube_id' | 'landing_show_episode_hosts'> & {
  spotify_episode_id: string;
} & DbHostJoin<'landing_podcast_episode_hosts'>;

function mapHosts(
  rows: Array<{ display_order: number; landing_team: DbTeamMember | DbTeamMember[] | null }>,
): EpisodeHost[] {
  return rows
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .flatMap((r) => {
      const t = r.landing_team;
      if (!t) return [];
      // PostgREST renvoie un objet (FK 1-1) ou un tableau selon le contexte ; on couvre les deux.
      const list = Array.isArray(t) ? t : [t];
      return list.map((m): EpisodeHost => {
        const photo: EpisodeHostPhoto =
          m.photo_kind === 'image' && m.photo_url
            ? { kind: 'image', url: m.photo_url, initials: m.initials }
            : {
                kind: 'gradient',
                from: m.photo_from ?? '#2a3142',
                to: m.photo_to ?? '#4a5266',
                initials: m.initials,
              };
        return { id: m.id, name: m.name, nick: m.nick, initials: m.initials, photo };
      });
    });
}

function mapShowRow(r: DbShowRow): ShowEpisode {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.description ?? '',
    youtubeId: r.youtube_id,
    thumbnailUrl: r.thumbnail_url,
    durationSeconds: r.duration_seconds,
    publishedAt: r.published_at,
    season: r.season,
    episodeNumber: r.episode_number,
    displayOrder: r.display_order,
    seoTitle: r.seo_title,
    seoDescription: r.seo_description,
    guests: r.guests ?? [],
    mentions: r.mentions ?? [],
    chapters: r.chapters ?? [],
    hosts: mapHosts(r.landing_show_episode_hosts ?? []),
  };
}

function mapPodcastRow(r: DbPodcastRow): PodcastEpisode {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.description ?? '',
    spotifyEpisodeId: r.spotify_episode_id,
    thumbnailUrl: r.thumbnail_url,
    durationSeconds: r.duration_seconds,
    publishedAt: r.published_at,
    season: r.season,
    episodeNumber: r.episode_number,
    displayOrder: r.display_order,
    seoTitle: r.seo_title,
    seoDescription: r.seo_description,
    guests: r.guests ?? [],
    mentions: r.mentions ?? [],
    chapters: r.chapters ?? [],
    hosts: mapHosts(r.landing_podcast_episode_hosts ?? []),
  };
}

// ============================================================
// Loaders : émissions YouTube
// ============================================================

export const getShowEpisodes = cache(async (): Promise<ShowEpisode[]> => {
  const supabase = createAnonServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('landing_show_episodes')
    .select(SHOW_SELECT)
    .eq('status', 'published')
    .order('display_order', { ascending: false })
    .order('published_at', { ascending: false, nullsFirst: false });

  if (error || !data) return [];
  return (data as unknown as DbShowRow[]).map(mapShowRow);
});

export const getShowEpisodeBySlug = cache(
  async (slug: string): Promise<ShowEpisode | null> => {
    const supabase = createAnonServerClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('landing_show_episodes')
      .select(SHOW_SELECT)
      .eq('status', 'published')
      .eq('slug', slug)
      .maybeSingle();

    if (error || !data) return null;
    return mapShowRow(data as unknown as DbShowRow);
  },
);

// ============================================================
// Loaders : podcasts Spotify
// ============================================================

export const getPodcastEpisodes = cache(async (): Promise<PodcastEpisode[]> => {
  const supabase = createAnonServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('landing_podcast_episodes')
    .select(PODCAST_SELECT)
    .eq('status', 'published')
    .order('display_order', { ascending: false })
    .order('published_at', { ascending: false, nullsFirst: false });

  if (error || !data) return [];
  return (data as unknown as DbPodcastRow[]).map(mapPodcastRow);
});

export const getPodcastEpisodeBySlug = cache(
  async (slug: string): Promise<PodcastEpisode | null> => {
    const supabase = createAnonServerClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('landing_podcast_episodes')
      .select(PODCAST_SELECT)
      .eq('status', 'published')
      .eq('slug', slug)
      .maybeSingle();

    if (error || !data) return null;
    return mapPodcastRow(data as unknown as DbPodcastRow);
  },
);
