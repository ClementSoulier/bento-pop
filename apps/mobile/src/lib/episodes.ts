import { withAbortTimeout } from './abort-timeout';
import { relativeDate } from './relative-date';

/**
 * Les épisodes de l'émission et du podcast Bento Pop dans « La table ».
 * Chantier 19, lot 2.
 *
 * Ils viennent de la landing, `GET /api/episodes`, et jamais de sa base :
 * seule la landing sait cacher un épisode programmé (§4.2 de la spec). L'app
 * n'en garde que ce qu'elle peut afficher et ouvrir sans risque. Un épisode
 * dont un champ manque, ou dont l'adresse n'est pas celle d'une plateforme
 * connue ou d'une page d'épisode du site, est écarté, seul, jamais la liste
 * (D8). Et la landing en panne laisse le fil sans épisode, sans message (D9) :
 * c'est à l'écran de traiter l'erreur levée ici comme une liste vide.
 *
 * Tout ici est pur, `fetch`, l'heure et l'adresse de la landing injectés,
 * pour être testé dans node. L'adresse réelle vient de `landing-url.ts`.
 */

export type EpisodePlatform = 'youtube' | 'spotify' | 'deezer' | 'apple' | 'site';

export type FeedEpisode = {
  /** Clé de liste, distincte de celles des bentos : `episode:<type>:<id>`. */
  key: string;
  id: string;
  kind: 'show' | 'podcast';
  slug: string;
  title: string;
  /** Telle que la landing la rend : ISO 8601 en UTC, à la milliseconde. */
  publishedAt: string;
  /** La même, en millisecondes, pour la fusion avec les bentos. */
  publishedAtMs: number;
  season: number;
  episodeNumber: number | null;
  durationSeconds: number | null;
  /** Toujours en `https`, ou `null` : la carte prend alors un fond plein. */
  thumbnailUrl: string | null;
  platform: EpisodePlatform;
  openUrl: string;
};

export const EPISODES_QUERY_KEY = ['episodes'] as const;

/** 5 s, comme le compteur de visites : au-delà, le fil reste sans épisode. */
export const EPISODES_TIMEOUT_MS = 5000;

/** Les épisodes valent 5 minutes, et se redemandent au tirer pour rafraîchir. */
export const EPISODES_STALE_MS = 5 * 60 * 1000;

export const DEFAULT_LANDING_URL = 'https://bento-pop.com';

type ParsedUrl = { protocol: 'http' | 'https'; host: string; path: string };

/**
 * Le protocole, l'hôte et le chemin d'une adresse, ou `null`. Une expression
 * plutôt que `URL` : sous Hermes, `URL` ne tient que par le polyfill qu'importe
 * le client Supabase, et ce module ne doit dépendre de rien.
 */
function parseUrl(raw: string): ParsedUrl | null {
  const match = /^(https?):\/\/([^/?#\s@]+)(\/[^?#\s]*)?(?:[?#]\S*)?$/i.exec(raw);
  if (!match) return null;
  return {
    protocol: match[1]!.toLowerCase() as 'http' | 'https',
    host: match[2]!.toLowerCase(),
    path: match[3] ?? '/',
  };
}

/**
 * L'adresse de la landing, ramenée à son origine. Une valeur absente ou
 * illisible retombe sur `bento-pop.com` : une variable mal posée ne doit pas
 * vider le fil de ses épisodes sans rien dire.
 */
export function normalizeLandingUrl(raw: string | null | undefined): string {
  const url = raw ? parseUrl(raw.trim()) : null;
  return url ? `${url.protocol}://${url.host}` : DEFAULT_LANDING_URL;
}

/** Les hôtes que l'app accepte d'ouvrir pour chaque plateforme (D8). */
const PLATFORM_HOSTS: Record<Exclude<EpisodePlatform, 'site'>, readonly string[]> = {
  youtube: ['www.youtube.com', 'youtube.com', 'm.youtube.com', 'youtu.be'],
  spotify: ['open.spotify.com'],
  deezer: ['www.deezer.com', 'deezer.com'],
  apple: ['podcasts.apple.com'],
};

const PLATFORMS_BY_KIND: Record<FeedEpisode['kind'], readonly EpisodePlatform[]> = {
  show: ['youtube', 'site'],
  podcast: ['spotify', 'deezer', 'apple', 'site'],
};

/**
 * L'adresse qu'ouvre le tap est-elle sûre ? En `https` sur l'hôte de sa
 * plateforme ; ou, pour un épisode que sa plateforme n'a pas repris (D13), une
 * page d'épisode de la landing que l'app connaît, `http` compris : c'est celle
 * de la recette locale.
 */
export function isAllowedOpenUrl(
  raw: string,
  platform: EpisodePlatform,
  landingUrl: string,
): boolean {
  const url = parseUrl(raw);
  if (!url) return false;
  if (platform === 'site') {
    const landing = parseUrl(landingUrl);
    return (
      landing !== null &&
      url.protocol === landing.protocol &&
      url.host === landing.host &&
      /^\/(emissions|podcasts)\/[^/]+$/.test(url.path)
    );
  }
  return url.protocol === 'https' && PLATFORM_HOSTS[platform].includes(url.host);
}

/**
 * Millisecondes d'une date ISO. La fraction est ramenée à trois chiffres :
 * PostgREST rend les microsecondes, et tous les moteurs ne les lisent pas.
 */
export function timeOf(iso: string): number {
  return Date.parse(iso.replace(/(\.\d{3})\d+/, '$1'));
}

const nonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** Un épisode de la réponse, vérifié champ par champ, ou `null`. */
export function parseEpisode(raw: unknown, landingUrl: string): FeedEpisode | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const kind = r.kind === 'show' || r.kind === 'podcast' ? r.kind : null;
  if (!kind) return null;
  const platform = PLATFORMS_BY_KIND[kind].find((p) => p === r.platform);
  if (!platform) return null;
  if (!nonEmpty(r.id) || !nonEmpty(r.slug) || !nonEmpty(r.title) || !nonEmpty(r.publishedAt))
    return null;
  if (!nonEmpty(r.openUrl) || !isAllowedOpenUrl(r.openUrl, platform, landingUrl)) return null;
  const publishedAtMs = timeOf(r.publishedAt);
  if (Number.isNaN(publishedAtMs) || !finite(r.season)) return null;

  const thumbnail = nonEmpty(r.thumbnailUrl) ? parseUrl(r.thumbnailUrl) : null;
  return {
    key: `episode:${kind}:${r.id}`,
    id: r.id,
    kind,
    slug: r.slug,
    title: r.title.trim(),
    publishedAt: r.publishedAt,
    publishedAtMs,
    season: r.season,
    episodeNumber: finite(r.episodeNumber) ? r.episodeNumber : null,
    durationSeconds: finite(r.durationSeconds) && r.durationSeconds > 0 ? r.durationSeconds : null,
    thumbnailUrl: thumbnail?.protocol === 'https' ? (r.thumbnailUrl as string) : null,
    platform,
    openUrl: r.openUrl,
  };
}

/**
 * Du plus récent au plus ancien ; à date égale l'émission d'abord, puis
 * l'identifiant. L'ordre de la route, refait ici : la fusion ne doit pas
 * dépendre de lui.
 */
export function compareEpisodes(a: FeedEpisode, b: FeedEpisode): number {
  return (
    b.publishedAtMs - a.publishedAtMs ||
    (a.kind === b.kind ? 0 : a.kind === 'show' ? -1 : 1) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/** La réponse de la route : les épisodes valides, sans doublon, dans l'ordre. */
export function parseEpisodes(body: unknown, landingUrl: string): FeedEpisode[] {
  const list =
    body && typeof body === 'object' ? (body as { episodes?: unknown }).episodes : undefined;
  if (!Array.isArray(list)) return [];
  const byKey = new Map<string, FeedEpisode>();
  for (const raw of list) {
    const episode = parseEpisode(raw, landingUrl);
    if (episode && !byKey.has(episode.key)) byKey.set(episode.key, episode);
  }
  return [...byKey.values()].sort(compareEpisodes);
}

/** Charge les épisodes. Lève sur un statut d'erreur : React Query garde la valeur d'avant. */
export async function loadEpisodes(
  fetchFn: typeof fetch,
  landingUrl: string,
  signal?: AbortSignal,
): Promise<FeedEpisode[]> {
  const res = await fetchFn(`${landingUrl}/api/episodes`, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!res.ok) throw new Error(`Episodes load failed: ${res.status}`);
  return parseEpisodes(await res.json(), landingUrl);
}

/**
 * Options de `useQuery` : 5 minutes de fraîcheur, aucun réessai, une panne
 * se lit comme « pas d'épisode » (D9). Le délai est un paramètre pour les
 * tests.
 */
export function episodesQueryOptions(
  fetchFn: typeof fetch,
  landingUrl: string,
  timeoutMs: number = EPISODES_TIMEOUT_MS,
) {
  return {
    queryKey: EPISODES_QUERY_KEY,
    queryFn: ({ signal }: { signal: AbortSignal }): Promise<FeedEpisode[]> =>
      withAbortTimeout((attempt) => loadEpisodes(fetchFn, landingUrl, attempt), timeoutMs, signal),
    staleTime: EPISODES_STALE_MS,
    retry: false,
  };
}

/** « S2 · E5 », ou « S2 » sans numéro d'épisode : la pastille de la carte du site. */
export function episodeBadgeLabel(episode: Pick<FeedEpisode, 'season' | 'episodeNumber'>): string {
  return episode.episodeNumber != null
    ? `S${episode.season} · E${episode.episodeNumber}`
    : `S${episode.season}`;
}

/**
 * La durée de la carte, au format du site (`formatDurationShort`) :
 * « 42min », « 1h 05min ». Vide sans durée.
 */
export function episodeDurationLabel(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}min`;
  if (m > 0) return `${m}min`;
  return `${s}s`;
}

/** La durée dite, pour VoiceOver et TalkBack : « 1 heure 5 minutes ». */
function spokenDuration(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [
    h > 0 ? `${h} heure${h > 1 ? 's' : ''}` : '',
    m > 0 ? `${m} minute${m > 1 ? 's' : ''}` : '',
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : `${Math.floor(seconds)} secondes`;
}

/**
 * Le libellé d'une carte, d'un seul élément : « Émission Bento Pop, saison 2,
 * épisode 5 : titre. 42 minutes. Publiée il y a 3 jours. » (§5.3).
 */
export function episodeAccessibilityLabel(episode: FeedEpisode, now?: number): string {
  const what = episode.kind === 'show' ? 'Émission Bento Pop' : 'Podcast Bento Pop';
  const number =
    episode.episodeNumber != null
      ? `saison ${episode.season}, épisode ${episode.episodeNumber}`
      : `saison ${episode.season}`;
  const parts = [`${what}, ${number} : ${episode.title}.`];
  const duration = spokenDuration(episode.durationSeconds);
  if (duration) parts.push(`${duration}.`);
  const when = relativeDate(episode.publishedAt, now);
  if (when) parts.push(`${episode.kind === 'show' ? 'Publiée' : 'Publié'} ${when}.`);
  return parts.join(' ');
}

const OPEN_HINTS: Record<EpisodePlatform, string> = {
  youtube: 'S’ouvre dans YouTube.',
  spotify: 'S’ouvre dans Spotify.',
  deezer: 'S’ouvre dans Deezer.',
  apple: 'S’ouvre dans Apple Podcasts.',
  site: 'S’ouvre sur bento-pop.com.',
};

/** L'indication d'accessibilité : où mène le tap. */
export function episodeOpenHint(platform: EpisodePlatform): string {
  return OPEN_HINTS[platform];
}
