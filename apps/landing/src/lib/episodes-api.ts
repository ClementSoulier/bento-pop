/**
 * Les épisodes que l'app range dans « La table », servis par `/api/episodes`.
 * Chantier 19.
 *
 * L'app ne lit pas la base de la landing : la date de publication n'y est
 * appliquée que par le code de la landing, pas par la RLS, et la lire de
 * l'app montrerait les épisodes programmés avant leur sortie. Elle passe donc
 * par cette route, qui ne rend que ce que la carte du fil affiche (D11) : ni
 * description, ni invités, ni animateurs, ni œuvres citées, ni lien audio.
 *
 * Tout ici est pur, l'heure et l'adresse du site comprises, pour être testé
 * sans réseau. Un épisode sans date ou programmé est écarté, seul, jamais la
 * liste (D6). Un épisode que sa plateforme n'a pas encore repris garde sa
 * place, et s'ouvre sur sa page du site (D13).
 */
import { youtubeThumbnail } from './episodes';
import { isRealEpisodeId } from './podcast-player';
import { isAudioPlatform, resolveAudioPlatform, type AudioPlatform } from './podcast-platform';

/** Où mène le tap. `site` : la page de l'épisode sur bento-pop.com (D13). */
export type ApiEpisodePlatform = 'youtube' | AudioPlatform | 'site';

export type ApiEpisode = {
  id: string;
  kind: 'show' | 'podcast';
  slug: string;
  title: string;
  /** ISO 8601 en UTC, à la milliseconde. */
  publishedAt: string;
  season: number;
  episodeNumber: number | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  platform: ApiEpisodePlatform;
  /** L'adresse qu'ouvre le tap : la vidéo, la page de l'épisode sur sa plateforme, ou sur le site. */
  openUrl: string;
};

/** Les colonnes lues pour une émission, et rien de plus. */
export const SHOW_API_SELECT =
  'id, slug, title, youtube_id, thumbnail_url, duration_seconds, published_at, season, episode_number';

/** Les colonnes lues pour un podcast, et rien de plus. */
export const PODCAST_API_SELECT =
  'id, slug, title, spotify_episode_id, audio_platform, audio_show_id, thumbnail_url, duration_seconds, published_at, season, episode_number';

export type ShowEpisodeRow = {
  id: string;
  slug: string;
  title: string;
  youtube_id: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  published_at: string | null;
  season: number;
  episode_number: number | null;
};

export type PodcastEpisodeRow = {
  id: string;
  slug: string;
  title: string;
  spotify_episode_id: string | null;
  audio_platform: string | null;
  audio_show_id: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  published_at: string | null;
  season: number;
  episode_number: number | null;
};

export type EpisodeRows = { shows: ShowEpisodeRow[]; podcasts: PodcastEpisodeRow[] };

/**
 * Un identifiant de vidéo YouTube : onze caractères, lettres, chiffres, `-`
 * et `_`. « A_REMPLACER », le marqueur des fiches dont on ne connaît pas
 * encore l'identifiant, en a justement onze : il est écarté à part.
 */
function isRealYoutubeId(id: string): boolean {
  return /^[A-Za-z0-9_-]{11}$/.test(id) && id !== 'A_REMPLACER' && !id.startsWith('TODO_');
}

/**
 * La date de publication, ramenée à l'ISO en UTC, ou `null` si elle manque,
 * ne se lit pas, ou n'est pas encore passée. La base écarte déjà les épisodes
 * programmés ; refaire le test ici ne coûte rien et ne dépend plus d'elle.
 */
function publishedAtOf(raw: string | null, now: number): string | null {
  if (!raw) return null;
  const time = Date.parse(raw);
  if (Number.isNaN(time) || time > now) return null;
  return new Date(time).toISOString();
}

/** Une durée exploitable, ou `null` : la carte n'affiche alors aucune durée. */
function durationOf(seconds: number | null): number | null {
  return seconds != null && Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : null;
}

/** Une vignette en `https`, la seule que l'app chargera, ou `null`. */
function httpsUrl(raw: string | null): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    return new URL(value).protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

/** La page d'un épisode sur le site, qui le lit même sans plateforme. */
function sitePage(siteUrl: string, kind: ApiEpisode['kind'], slug: string): string {
  return `${siteUrl.replace(/\/$/, '')}/${kind === 'show' ? 'emissions' : 'podcasts'}/${encodeURIComponent(slug)}`;
}

export function showToApiEpisode(
  row: ShowEpisodeRow,
  now: number,
  siteUrl: string,
): ApiEpisode | null {
  const publishedAt = publishedAtOf(row.published_at, now);
  if (!publishedAt) return null;
  const youtubeId = row.youtube_id?.trim() ?? '';
  const known = isRealYoutubeId(youtubeId);
  return {
    id: row.id,
    kind: 'show',
    slug: row.slug,
    title: row.title,
    publishedAt,
    season: row.season,
    episodeNumber: row.episode_number,
    durationSeconds: durationOf(row.duration_seconds),
    // La vignette saisie au back-office, sinon celle de YouTube, comme la
    // carte d'épisode du site.
    thumbnailUrl: httpsUrl(row.thumbnail_url) ?? (known ? youtubeThumbnail(youtubeId, 'hq') : null),
    ...(known
      ? { platform: 'youtube' as const, openUrl: `https://www.youtube.com/watch?v=${youtubeId}` }
      : { platform: 'site' as const, openUrl: sitePage(siteUrl, 'show', row.slug) }),
  };
}

export function podcastToApiEpisode(
  row: PodcastEpisodeRow,
  now: number,
  siteUrl: string,
): ApiEpisode | null {
  const publishedAt = publishedAtOf(row.published_at, now);
  if (!publishedAt) return null;
  const episodeId = row.spotify_episode_id?.trim() ?? '';
  // Même défaut que la page du podcast, `mapPodcastRow` : Spotify.
  const platform: AudioPlatform = isAudioPlatform(row.audio_platform)
    ? row.audio_platform
    : 'spotify';
  const showId = row.audio_show_id?.trim() ?? '';
  // La règle de la page du podcast, `isRealEpisodeId` ; Apple Podcasts ne
  // retrouve en plus un épisode que par son émission.
  const known =
    isRealEpisodeId(platform, episodeId) && (platform !== 'apple' || /^\d+$/.test(showId));
  return {
    id: row.id,
    kind: 'podcast',
    slug: row.slug,
    title: row.title,
    publishedAt,
    season: row.season,
    episodeNumber: row.episode_number,
    durationSeconds: durationOf(row.duration_seconds),
    thumbnailUrl: httpsUrl(row.thumbnail_url),
    ...(known
      ? { platform, openUrl: resolveAudioPlatform({ platform, episodeId, showId }).pageUrl }
      : { platform: 'site' as const, openUrl: sitePage(siteUrl, 'podcast', row.slug) }),
  };
}

/**
 * Émissions et podcasts mêlés, du plus récent au plus ancien. À date égale,
 * l'émission d'abord, puis l'identifiant : un ordre total, que l'app retrouve
 * d'un appel à l'autre.
 */
export function toApiEpisodes(rows: EpisodeRows, now: number, siteUrl: string): ApiEpisode[] {
  const episodes = [
    ...rows.shows.map((row) => showToApiEpisode(row, now, siteUrl)),
    ...rows.podcasts.map((row) => podcastToApiEpisode(row, now, siteUrl)),
  ].filter((episode): episode is ApiEpisode => episode !== null);

  return episodes.sort(
    (a, b) =>
      b.publishedAt.localeCompare(a.publishedAt) ||
      (a.kind === b.kind ? 0 : a.kind === 'show' ? -1 : 1) ||
      a.id.localeCompare(b.id),
  );
}
