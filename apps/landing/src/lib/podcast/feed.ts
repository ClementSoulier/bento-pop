/**
 * Fabrique le flux RSS du podcast, celui que lisent Apple Podcasts, Spotify et Deezer.
 *
 * Ce flux remplace celui de RSS.com. Deux choses le rendent moins anodin qu'un sitemap :
 *
 * 1. Les applis d'écoute reconnaissent un épisode à son `<guid>`. Changer un guid, c'est
 *    faire réapparaître l'épisode en « nouveau » chez tous les abonnés. On ne publie donc
 *    jamais un épisode sans guid, et on ne le recalcule pas : il vient de la base, repris
 *    de RSS.com pour les épisodes migrés.
 * 2. Le podcast mélange les deux rubriques du site. Les émissions sortent aussi en audio,
 *    le mardi qui suit leur sortie YouTube — d'où `audio_published_at`, distinct de
 *    `published_at` qui reste la date de la page et de la vidéo.
 *
 * Le XML est écrit à la main plutôt qu'avec une bibliothèque : le format est figé, les
 * cas particuliers (échappement, CDATA, namespaces iTunes et Podcasting 2.0) sont peu
 * nombreux, et une dépendance de plus serait un risque pour un gain nul.
 */

export type FeedSettings = {
  title: string;
  description: string;
  author: string;
  owner_name: string;
  owner_email: string;
  language: string;
  category: string;
  subcategory: string;
  image_url: string;
  podcast_guid: string;
  copyright: string;
  explicit: boolean;
  podcast_type: 'episodic' | 'serial';
  link: string;
  locked: boolean;
};

export type FeedEpisode = {
  slug: string;
  title: string;
  description: string;
  /** Rubrique du site, qui détermine l'adresse de la page. */
  kind: 'emission' | 'podcast';
  audio_url: string;
  audio_bytes: number;
  audio_mime: string;
  audio_published_at: string;
  duration_seconds: number | null;
  feed_guid: string;
  feed_season: number | null;
  feed_number: number | null;
  explicit: boolean;
  episode_type: 'full' | 'trailer' | 'bonus';
  thumbnail_url: string | null;
};

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

/**
 * Échappe le texte destiné à un attribut ou à un nœud.
 *
 * Les caractères de contrôle sont retirés plutôt qu'échappés : XML 1.0 les interdit même
 * sous forme d'entité, et un seul suffit à rendre tout le flux illisible par les applis.
 */
export function escapeXml(value: string): string {
  return (
    value
      // Ces caractères sont bien ceux qu'on veut viser : XML 1.0 les interdit, même
      // sous forme d'entité. La règle qui les signale ne connaît pas ce cas.
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c)
  );
}

/** Les descriptions contiennent des puces et des retours à la ligne : on les protège. */
function cdata(value: string): string {
  // `]]>` fermerait la section au milieu du texte : on la coupe en deux.
  return `<![CDATA[${value.replace(/\]\]>/g, ']]]]><![CDATA[>')}]]>`;
}

/** Date au format RFC 2822, seul format que toutes les applis acceptent. */
export function rfc2822(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`Date illisible : ${iso}`);
  return d.toUTCString().replace('GMT', '+0000');
}

/** Durée en HH:MM:SS, ce qu'attend iTunes. */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const parts = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60];
  return parts.map((n) => String(n).padStart(2, '0')).join(':');
}

/**
 * Écarte les épisodes qu'on ne peut pas annoncer, et trie du plus récent au plus ancien.
 *
 * Un épisode sans fichier ou sans guid n'est pas une erreur à signaler bruyamment : c'est
 * un brouillon en cours. On le laisse de côté, le reste du flux doit rester valide.
 */
export function publishableEpisodes(
  episodes: FeedEpisode[],
  now: Date = new Date(),
): FeedEpisode[] {
  return episodes
    .filter(
      (e) =>
        e.feed_guid &&
        e.audio_url &&
        e.audio_bytes > 0 &&
        e.audio_published_at &&
        new Date(e.audio_published_at).getTime() <= now.getTime(),
    )
    .sort(
      (a, b) => new Date(b.audio_published_at).getTime() - new Date(a.audio_published_at).getTime(),
    );
}

function itemXml(episode: FeedEpisode, settings: FeedSettings): string {
  const pagePath = episode.kind === 'emission' ? 'emissions' : 'podcasts';
  const pageUrl = `${settings.link.replace(/\/$/, '')}/${pagePath}/${episode.slug}`;
  const lines = [
    '    <item>',
    `      <title>${escapeXml(episode.title)}</title>`,
    `      <description>${cdata(episode.description)}</description>`,
    `      <link>${escapeXml(pageUrl)}</link>`,
    // isPermaLink="false" : le guid est un identifiant, pas une adresse à visiter.
    `      <guid isPermaLink="false">${escapeXml(episode.feed_guid)}</guid>`,
    `      <pubDate>${rfc2822(episode.audio_published_at)}</pubDate>`,
    `      <enclosure url="${escapeXml(episode.audio_url)}" length="${episode.audio_bytes}" type="${escapeXml(episode.audio_mime)}" />`,
    `      <itunes:explicit>${episode.explicit ? 'true' : 'false'}</itunes:explicit>`,
    `      <itunes:episodeType>${episode.episode_type}</itunes:episodeType>`,
  ];
  if (episode.duration_seconds) {
    lines.push(
      `      <itunes:duration>${formatDuration(episode.duration_seconds)}</itunes:duration>`,
    );
  }
  if (episode.feed_season)
    lines.push(`      <itunes:season>${episode.feed_season}</itunes:season>`);
  if (episode.feed_number)
    lines.push(`      <itunes:episode>${episode.feed_number}</itunes:episode>`);
  if (episode.thumbnail_url) {
    lines.push(`      <itunes:image href="${escapeXml(episode.thumbnail_url)}" />`);
  }
  lines.push('    </item>');
  return lines.join('\n');
}

/**
 * @param feedUrl adresse publique du flux, qu'il doit déclarer lui-même (`atom:link`) :
 *   c'est ainsi que les annuaires savent qu'ils lisent bien la bonne source.
 */
export function buildFeed(
  settings: FeedSettings,
  episodes: FeedEpisode[],
  feedUrl: string,
  now: Date = new Date(),
): string {
  const items = publishableEpisodes(episodes, now);
  const lastBuild = items[0]?.audio_published_at ?? now.toISOString();
  const head = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0"',
    '     xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"',
    '     xmlns:podcast="https://podcastindex.org/namespace/1.0"',
    '     xmlns:atom="http://www.w3.org/2005/Atom"',
    '     xmlns:content="http://purl.org/rss/1.0/modules/content/">',
    '  <channel>',
    `    <title>${escapeXml(settings.title)}</title>`,
    `    <description>${cdata(settings.description)}</description>`,
    `    <link>${escapeXml(settings.link)}</link>`,
    `    <language>${escapeXml(settings.language)}</language>`,
    `    <copyright>${escapeXml(settings.copyright)}</copyright>`,
    `    <lastBuildDate>${rfc2822(lastBuild)}</lastBuildDate>`,
    `    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />`,
    `    <itunes:author>${escapeXml(settings.author)}</itunes:author>`,
    `    <itunes:summary>${cdata(settings.description)}</itunes:summary>`,
    `    <itunes:type>${settings.podcast_type}</itunes:type>`,
    `    <itunes:explicit>${settings.explicit ? 'true' : 'false'}</itunes:explicit>`,
    `    <itunes:image href="${escapeXml(settings.image_url)}" />`,
    '    <itunes:owner>',
    `      <itunes:name>${escapeXml(settings.owner_name)}</itunes:name>`,
    `      <itunes:email>${escapeXml(settings.owner_email)}</itunes:email>`,
    '    </itunes:owner>',
    settings.subcategory
      ? `    <itunes:category text="${escapeXml(settings.category)}">\n      <itunes:category text="${escapeXml(settings.subcategory)}" />\n    </itunes:category>`
      : `    <itunes:category text="${escapeXml(settings.category)}" />`,
    // Podcasting 2.0 : identifiant stable du podcast, et verrou contre un import sauvage.
    `    <podcast:guid>${escapeXml(settings.podcast_guid)}</podcast:guid>`,
    `    <podcast:locked owner="${escapeXml(settings.owner_email)}">${settings.locked ? 'yes' : 'no'}</podcast:locked>`,
  ];
  return [...head, ...items.map((e) => itemXml(e, settings)), '  </channel>', '</rss>', ''].join(
    '\n',
  );
}
