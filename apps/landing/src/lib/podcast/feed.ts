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
  /** Titre propre aux plateformes audio. Vide : on prend `title`. */
  audio_title: string;
  /** Description propre aux plateformes audio, HTML simple ou texte. Vide : `description`. */
  audio_description: string;
  /** Image carrée de l'épisode. Vide : les applis montrent la pochette du podcast. */
  audio_image_url: string;
};

/** Caractères que XML 1.0 interdit partout, même en entité et même dans une section CDATA. */
// La règle qui signale les caractères de contrôle dans une regex ne connaît pas ce cas :
// ce sont bien eux qu'on vise.
// eslint-disable-next-line no-control-regex
const INTERDITS_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

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
  return value.replace(INTERDITS_XML, '').replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);
}

/** Les descriptions contiennent du HTML et des retours à la ligne : on les protège. */
function cdata(value: string): string {
  // `]]>` fermerait la section au milieu du texte : on la coupe en deux.
  return `<![CDATA[${value.replace(INTERDITS_XML, '').replace(/\]\]>/g, ']]]]><![CDATA[>')}]]>`;
}

/** Échappement du texte destiné à du HTML : `&apos;` n'y est pas reconnu partout. */
function echapperHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Rend cliquables les adresses d'un texte déjà échappé, sans avaler la ponctuation qui suit. */
function lierAdresses(value: string): string {
  return value.replace(/https?:\/\/[^\s<"]+/g, (trouve) => {
    const adresse = trouve.replace(/[.,;:!?)»]+$/, '');
    return `<a href="${adresse}">${adresse}</a>${trouve.slice(adresse.length)}`;
  });
}

/**
 * Met une description en HTML simple, ce que les applis d'écoute savent afficher : en
 * texte brut, Apple Podcasts colle tous les paragraphes les uns aux autres.
 *
 * Une description qui commence par une balise est déjà du HTML, c'est le cas de celles
 * reprises de RSS.com : elle passe telle quelle, pour rester identique à l'octet près.
 * Un texte saisi dans l'admin devient des paragraphes (séparés par une ligne vide), ses
 * retours à la ligne des `<br>` et ses adresses des liens.
 */
export function descriptionHtml(texte: string): string {
  const brut = texte.replace(/\r\n?/g, '\n').trim();
  if (!brut) return '';
  if (/^<[a-z]/i.test(brut)) return texte;
  return brut
    .split(/\n\s*\n/)
    .map(
      (bloc) =>
        `<p>${bloc
          .trim()
          .split('\n')
          .map((ligne) => lierAdresses(echapperHtml(ligne.trim())))
          .join('<br>')}</p>`,
    )
    .join('');
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
  // Les textes audio priment : ce sont ceux que les auditeurs connaissent déjà.
  const titre = episode.audio_title.trim() ? episode.audio_title : episode.title;
  const description = episode.audio_description.trim()
    ? episode.audio_description
    : episode.description;
  const lines = [
    '    <item>',
    `      <title>${escapeXml(titre)}</title>`,
    `      <itunes:title>${escapeXml(titre)}</itunes:title>`,
    `      <description>${cdata(descriptionHtml(description))}</description>`,
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
  // La numérotation en double, iTunes et Podcasting 2.0, comme le faisait RSS.com.
  if (episode.feed_season) {
    lines.push(`      <itunes:season>${episode.feed_season}</itunes:season>`);
    lines.push(`      <podcast:season>${episode.feed_season}</podcast:season>`);
  }
  if (episode.feed_number) {
    lines.push(`      <itunes:episode>${episode.feed_number}</itunes:episode>`);
    lines.push(`      <podcast:episode>${episode.feed_number}</podcast:episode>`);
  }
  // Pas de repli sur la miniature du site : elle est en 16:9, et les applis veulent un carré.
  if (episode.audio_image_url) {
    lines.push(`      <itunes:image href="${escapeXml(episode.audio_image_url)}" />`);
  }
  lines.push('    </item>');
  return lines.join('\n');
}

/**
 * La catégorie Apple et ses sous-catégories. Il peut y en avoir plusieurs, séparées par des
 * virgules dans le réglage : RSS.com déclarait « Leisure » avec « Hobbies » et « Video Games »,
 * et en perdre une retirerait le podcast de ce rayon d'Apple Podcasts. Aucun nom de
 * catégorie Apple ne contient de virgule.
 */
function categorieXml(settings: FeedSettings): string {
  const sous = settings.subcategory
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!sous.length) return `    <itunes:category text="${escapeXml(settings.category)}" />`;
  return [
    `    <itunes:category text="${escapeXml(settings.category)}">`,
    ...sous.map((s) => `      <itunes:category text="${escapeXml(s)}" />`),
    '    </itunes:category>',
  ].join('\n');
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
    categorieXml(settings),
    // Podcasting 2.0 : identifiant stable du podcast, et verrou contre un import sauvage.
    `    <podcast:guid>${escapeXml(settings.podcast_guid)}</podcast:guid>`,
    `    <podcast:locked owner="${escapeXml(settings.owner_email)}">${settings.locked ? 'yes' : 'no'}</podcast:locked>`,
  ];
  return [...head, ...items.map((e) => itemXml(e, settings)), '  </channel>', '</rss>', ''].join(
    '\n',
  );
}
