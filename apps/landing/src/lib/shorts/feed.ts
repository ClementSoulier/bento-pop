/**
 * Lecture du flux RSS d'une playlist YouTube (les shorts « Mon Bento Pop »).
 *
 * Mise en forme seulement, sans réseau : `source.ts` va chercher le XML.
 * Le flux public ne livre que les 15 premières vidéos de la playlist, sans
 * clé d'API. Le format Atom de YouTube est stable et plat, quelques
 * expressions régulières suffisent, pas besoin d'un analyseur XML.
 */

export type GuestShort = {
  youtubeId: string;
  /** Titre YouTube complet, pour l'accessibilité du bouton de lecture. */
  title: string;
  /** Nom de l'invité, tiré du titre « X fait son BentoPOP ! 🍱 ». */
  guest: string;
  publishedAt: string | null;
};

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const point =
        code[1] === 'x' || code[1] === 'X'
          ? Number.parseInt(code.slice(2), 16)
          : Number.parseInt(code.slice(1), 10);
      return Number.isFinite(point) ? String.fromCodePoint(point) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

function tag(entry: string, name: string): string | null {
  const m = entry.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m?.[1] != null ? decodeEntities(m[1].trim()) : null;
}

/**
 * « Gero Japan fait son BentoPOP ! 🍱 #bento #pop » → « Gero Japan ».
 * Le @ d'un pseudo est retiré. Si le titre ne suit pas la formule, on garde
 * le titre sans ses hashtags plutôt que de perdre le short.
 */
export function guestFromTitle(title: string): string {
  const m = title.match(/^(.+?)\s+fait\s+son\s+bento\s*pop\b/i);
  if (m?.[1]) return m[1].trim().replace(/^@/, '');
  return title.replace(/(^|\s)#\S+/g, '').trim() || title.trim();
}

const YOUTUBE_ID_RX = /^[A-Za-z0-9_-]{11}$/;

export function parseShortsFeed(xml: string): GuestShort[] {
  const shorts: GuestShort[] = [];
  for (const [, entry = ''] of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const youtubeId = tag(entry, 'yt:videoId');
    const title = tag(entry, 'title');
    if (!youtubeId || !YOUTUBE_ID_RX.test(youtubeId) || !title) continue;
    shorts.push({
      youtubeId,
      title,
      guest: guestFromTitle(title),
      publishedAt: tag(entry, 'published'),
    });
  }
  return shorts;
}
