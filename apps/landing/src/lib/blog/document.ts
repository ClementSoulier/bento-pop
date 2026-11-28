/**
 * Le document d'un article, tel que l'admin l'écrit (JSON Tiptap, cf. docs/BLOG.md D2).
 *
 * Mêmes garde-fous que `apps/admin/src/lib/blog/document.ts`, recopiés plutôt que
 * partagés : l'admin refuse à l'écriture, la landing ignore à la lecture. Un document
 * passé par une autre voie (SQL à la main) ne peut donc rien injecter.
 */

export type BlogMark = { type: string; attrs?: Record<string, unknown> };

export type BlogNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: BlogNode[];
  marks?: BlogMark[];
  text?: string;
};

export type BlogDoc = { type: 'doc'; content?: BlogNode[] };

export function asBlogDoc(value: unknown): BlogDoc {
  if (value && typeof value === 'object' && (value as { type?: unknown }).type === 'doc') {
    const content = (value as { content?: unknown }).content;
    return { type: 'doc', content: Array.isArray(content) ? (content as BlogNode[]) : [] };
  }
  return { type: 'doc', content: [] };
}

const SITE_HOSTS = new Set(['bento-pop.com', 'www.bento-pop.com']);

export type SafeLink = { href: string; external: boolean };

/**
 * Lien rendu tel quel s'il pointe en http(s), mailto, vers un chemin du site ou une
 * ancre ; null sinon (le texte reste, sans lien). Un lien absolu vers bento-pop.com
 * est ramené à son chemin, pour la navigation interne de Next.
 */
export function safeLink(value: unknown): SafeLink | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2000) return null;
  if ((value.startsWith('/') && !value.startsWith('//')) || value.startsWith('#')) {
    return { href: value, external: false };
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol === 'mailto:') return { href: value, external: false };
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (SITE_HOSTS.has(url.hostname)) {
    return { href: `${url.pathname}${url.search}${url.hash}` || '/', external: false };
  }
  return { href: url.toString(), external: true };
}

export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Identifiant d'une vidéo YouTube depuis ses formes d'URL courantes, ou null. */
export function youtubeIdFromUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') {
    id = url.pathname.slice(1).split('/')[0] ?? null;
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'music.youtube.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else {
      const match = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/);
      id = match?.[1] ?? null;
    }
  }
  return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
}

/** Texte d'un nœud et de ses enfants (ancres des intertitres). */
export function nodeText(node: BlogNode): string {
  if (node.type === 'text') return typeof node.text === 'string' ? node.text : '';
  return (node.content ?? []).map(nodeText).join('');
}

/** Ancre d'un intertitre : `#le-retour-de-zelda`. Unique dans l'article. */
export function headingAnchor(text: string, used: Set<string>): string {
  const base =
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/['’`]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'section';
  let anchor = base;
  for (let i = 2; used.has(anchor); i++) anchor = `${base}-${i}`;
  used.add(anchor);
  return anchor;
}

/** Nombre positif fini, ou null (dimensions d'image venues du document). */
export function positiveNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}
