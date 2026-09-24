/**
 * Lit en base ce qu'il faut pour fabriquer le flux RSS du podcast.
 *
 * Séparé de `feed.ts`, qui ne fait que de la mise en forme : le générateur reste ainsi
 * testable sans base, et c'est ici seulement qu'on parle à Supabase.
 *
 * On lit les deux tables : les émissions sortent aussi en podcast, le mardi qui suit
 * leur diffusion YouTube. Le tri et le filtrage des épisodes annonçables sont faits
 * dans `feed.ts`, sur les deux rubriques réunies.
 */
import { createAnonServerClient } from '@/lib/supabase/server';

import type { FeedEpisode, FeedSettings } from './feed';

const EPISODE_SELECT =
  'slug, title, description, audio_url, audio_bytes, audio_mime, audio_published_at, ' +
  'duration_seconds, feed_guid, feed_season, feed_number, explicit, episode_type, thumbnail_url';

type DbEpisodeRow = Omit<FeedEpisode, 'kind'>;

/** Réglages de repli : un flux incomplet vaut mieux qu'une page d'erreur. */
const SETTINGS_FALLBACK: FeedSettings = {
  title: 'Bento Pop!',
  description: '',
  author: 'Liventure SAS & Dark Hifus Production',
  owner_name: 'Bento Pop',
  owner_email: '',
  language: 'fr',
  category: 'Leisure',
  subcategory: '',
  image_url: '',
  podcast_guid: '',
  copyright: 'Liventure SAS & Dark Hifus Production',
  explicit: false,
  podcast_type: 'episodic',
  link: 'https://bento-pop.com',
  locked: true,
};

export async function getFeedSettings(): Promise<FeedSettings | null> {
  const supabase = createAnonServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('landing_podcast_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return { ...SETTINGS_FALLBACK, ...(data as Partial<FeedSettings>) };
}

export async function getFeedEpisodes(): Promise<FeedEpisode[]> {
  const supabase = createAnonServerClient();
  if (!supabase) return [];

  const tables = [
    { table: 'landing_show_episodes', kind: 'emission' as const },
    { table: 'landing_podcast_episodes', kind: 'podcast' as const },
  ];

  const resultats = await Promise.all(
    tables.map(async ({ table, kind }) => {
      const { data, error } = await supabase
        .from(table)
        .select(EPISODE_SELECT)
        .eq('status', 'published')
        .not('audio_published_at', 'is', null)
        .order('audio_published_at', { ascending: false });

      if (error || !data) return [];
      return (data as unknown as DbEpisodeRow[]).map((row) => ({ ...row, kind }));
    }),
  );

  return resultats.flat();
}
