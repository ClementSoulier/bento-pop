import { cache } from 'react';
import { createServerClient } from '@/lib/supabase/server';

export type HeroVideoConfig = {
  youtubeId: string;
  title: string;
  episodeLabel: string;
  live: boolean;
};

const STATIC_FALLBACK: HeroVideoConfig = {
  youtubeId: '8JVSPC2ozOw',
  title: 'Replay · Dernier épisode',
  episodeLabel: 'EP. 24 · 1h12',
  live: false,
};

/**
 * Charge la config de la vidéo embarquée dans le hero (table singleton
 * `landing_hero_video`, éditée via le BO `/links`).
 *
 * Retourne le fallback statique si Supabase n'est pas configuré ou si la
 * ligne n'existe pas — la landing reste affichable sans DB.
 */
export const loadHeroVideo = cache(async (): Promise<HeroVideoConfig> => {
  const supabase = await createServerClient();
  if (!supabase) return STATIC_FALLBACK;
  const { data, error } = await supabase
    .from('landing_hero_video')
    .select('youtube_id, title, episode_label, live')
    .eq('id', 'singleton')
    .maybeSingle();
  if (error || !data) return STATIC_FALLBACK;
  const row = data as unknown as {
    youtube_id: string;
    title: string;
    episode_label: string;
    live: boolean;
  };
  return {
    youtubeId: row.youtube_id,
    title: row.title,
    episodeLabel: row.episode_label,
    live: row.live,
  };
});
