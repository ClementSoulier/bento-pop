import { cache } from 'react';
import { createServerClient } from '@/lib/supabase/server';

export type HeroTiktokConfig = {
  enabled: boolean;
  /** ID numérique de la vidéo TikTok extrait de l'URL (null si invalide). */
  videoId: string | null;
  /** URL canonique de la vidéo (post original) — utilisée comme href de fallback. */
  postUrl: string | null;
};

/**
 * Extrait l'ID numérique d'une URL TikTok.
 * Formats supportés :
 *   - https://www.tiktok.com/@username/video/1234567890123456789
 *   - https://m.tiktok.com/v/1234567890123456789
 *   - https://vm.tiktok.com/XXXXXXXX/  → pas supporté (URL courte non résoluble côté serveur sans HEAD)
 */
export function extractTiktokId(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/\/(?:video|v)\/(\d+)/);
  return match?.[1] ?? null;
}

/**
 * Charge la config TikTok depuis la table singleton `landing_hero_tiktok`.
 * Si Supabase indisponible, table absente ou config invalide → enabled=false
 * et le hero retombe sur le layout legacy (Popy + Paris Manga en col 1).
 */
export const loadHeroTiktok = cache(async (): Promise<HeroTiktokConfig> => {
  const supabase = await createServerClient();
  if (!supabase) return { enabled: false, videoId: null, postUrl: null };
  const { data, error } = await supabase
    .from('landing_hero_tiktok')
    .select('tiktok_url, enabled')
    .eq('id', 'singleton')
    .maybeSingle();
  if (error || !data) return { enabled: false, videoId: null, postUrl: null };
  const row = data as unknown as { tiktok_url: string | null; enabled: boolean };
  const videoId = extractTiktokId(row.tiktok_url);
  return {
    enabled: row.enabled && Boolean(videoId),
    videoId,
    postUrl: row.tiktok_url,
  };
});
