/**
 * Helpers UI pour les épisodes (formatage durée / date, thumbnail YouTube).
 */

export function youtubeThumbnail(youtubeId: string, quality: 'hq' | 'maxres' = 'hq'): string {
  const variant = quality === 'maxres' ? 'maxresdefault' : 'hqdefault';
  return `https://i.ytimg.com/vi/${youtubeId}/${variant}.jpg`;
}

export function formatDurationShort(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}min`;
  if (m > 0) return `${m}min`;
  return `${s}s`;
}

export function formatTimecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

const DATE_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function formatPublishedDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return DATE_FORMATTER.format(d);
}

/**
 * Construit l'URL YouTube avec timecode (paramètre `t=` en secondes), pour
 * lier un chapitre vers le moment précis dans la vidéo.
 */
export function youtubeWatchUrl(youtubeId: string, startSeconds?: number): string {
  const base = `https://www.youtube.com/watch?v=${youtubeId}`;
  return startSeconds && startSeconds > 0 ? `${base}&t=${startSeconds}s` : base;
}

export const MENTION_TYPE_LABELS: Record<string, string> = {
  game: 'Jeu vidéo',
  movie: 'Film',
  series: 'Série',
  book: 'Livre',
  other: 'Autre',
};
