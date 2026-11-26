/**
 * Le document d'un article : JSON Tiptap (ProseMirror), cf. docs/BLOG.md D1 à D3.
 *
 * Le serveur de l'admin valide chaque document avant de l'écrire : seuls les nœuds et
 * les marques de la liste ci-dessous passent. La landing ignore de son côté tout ce
 * qu'elle ne connaît pas ; les deux gardes se complètent.
 */

export type BlogMark = {
  type: string;
  attrs?: Record<string, unknown>;
};

export type BlogNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: BlogNode[];
  marks?: BlogMark[];
  text?: string;
};

export type BlogDoc = { type: 'doc'; content?: BlogNode[] };

export const EMPTY_DOC: BlogDoc = { type: 'doc', content: [] };

/** Nœuds acceptés, avec les types d'enfants qu'ils peuvent contenir. */
const BLOCK_CHILDREN: Record<string, readonly string[]> = {
  doc: ['paragraph', 'heading', 'bulletList', 'orderedList', 'blockquote', 'horizontalRule', 'image', 'youtube', 'poll'],
  paragraph: ['text', 'hardBreak'],
  heading: ['text', 'hardBreak'],
  bulletList: ['listItem'],
  orderedList: ['listItem'],
  listItem: ['paragraph', 'bulletList', 'orderedList'],
  blockquote: ['paragraph', 'bulletList', 'orderedList'],
  horizontalRule: [],
  image: [],
  youtube: [],
  /* Résultats figés d'un sondage du Thermomètre, tout dans les attributs. */
  poll: [],
  text: [],
  hardBreak: [],
};

export const ALLOWED_MARKS = ['bold', 'italic', 'underline', 'strike', 'link'] as const;

/** Plafonds : un article de 20 000 mots tient très largement dessous. */
const MAX_JSON_BYTES = 600_000;
const MAX_DEPTH = 12;

export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2000) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Lien accepté dans un article : http(s), mailto, ou chemin relatif du site
 * (`/emissions/...`). Tout le reste (`javascript:`, `data:`...) est refusé.
 */
export function isSafeHref(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2000) return false;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  if (value.startsWith('#')) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' || url.protocol === 'mailto:';
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

export type DocValidation = { ok: true; doc: BlogDoc } | { ok: false; error: string };

/**
 * Vérifie qu'un document ne contient que ce que la landing sait rendre.
 * Renvoie un message en français pour le formulaire.
 */
export function validateBlogDoc(input: unknown): DocValidation {
  if (!input || typeof input !== 'object' || (input as { type?: unknown }).type !== 'doc') {
    return { ok: false, error: 'Contenu illisible : document attendu.' };
  }
  let size: number;
  try {
    size = JSON.stringify(input).length;
  } catch {
    return { ok: false, error: 'Contenu illisible.' };
  }
  if (size > MAX_JSON_BYTES) {
    return { ok: false, error: 'Article trop long : découpe-le en plusieurs articles.' };
  }
  const error = checkNode(input as BlogNode, 'doc', 0);
  return error ? { ok: false, error } : { ok: true, doc: input as BlogDoc };
}

function checkNode(node: BlogNode, parent: string, depth: number): string | null {
  if (depth > MAX_DEPTH) return 'Contenu trop imbriqué.';
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') {
    return 'Bloc illisible dans le contenu.';
  }
  const allowedHere = depth === 0 ? ['doc'] : (BLOCK_CHILDREN[parent] ?? []);
  if (!allowedHere.includes(node.type)) {
    return `Élément non pris en charge dans l'article : « ${node.type} ».`;
  }

  switch (node.type) {
    case 'text':
      if (typeof node.text !== 'string') return 'Texte illisible dans le contenu.';
      for (const mark of node.marks ?? []) {
        if (!(ALLOWED_MARKS as readonly string[]).includes(mark?.type)) {
          return `Mise en forme non prise en charge : « ${String(mark?.type)} ».`;
        }
        if (mark.type === 'link' && !isSafeHref(mark.attrs?.href)) {
          return `Lien refusé : « ${String(mark.attrs?.href ?? '')} ». Utilise une adresse http(s), mailto ou un chemin du site.`;
        }
      }
      return null;
    case 'heading': {
      const level = node.attrs?.level;
      if (level !== 2 && level !== 3) return 'Seuls les intertitres de niveau 2 et 3 sont acceptés.';
      break;
    }
    case 'image':
      if (!isHttpUrl(node.attrs?.src)) return 'Image sans adresse valide.';
      if (typeof node.attrs?.alt !== 'string' || node.attrs.alt.trim() === '') {
        return 'Chaque image a besoin d’un texte alternatif (description pour les lecteurs d’écran).';
      }
      return null;
    case 'youtube':
      if (!youtubeIdFromUrl(node.attrs?.src)) return 'Vidéo YouTube : adresse non reconnue.';
      return null;
    case 'poll':
      return checkPollAttrs(node.attrs);
  }

  if (node.marks && node.marks.length > 0) return 'Mise en forme inattendue sur un bloc.';
  for (const child of node.content ?? []) {
    const error = checkNode(child, node.type, depth + 1);
    if (error) return error;
  }
  return null;
}

/**
 * Bloc `poll` : question, 2 à 8 options avec leurs votes, et un total égal à leur
 * somme. La landing recalcule les pourcentages, elle ne reçoit que des entiers.
 */
function checkPollAttrs(attrs: Record<string, unknown> | undefined): string | null {
  const invalid = 'Bloc sondage illisible : réinsère-le depuis la barre d’outils.';
  if (!attrs) return invalid;
  const { question, options, total, weekTag, closedAt } = attrs;
  if (typeof question !== 'string' || question.trim() === '' || question.length > 300) return invalid;
  if (weekTag !== undefined && weekTag !== null && (typeof weekTag !== 'string' || weekTag.length > 80)) {
    return invalid;
  }
  if (closedAt !== undefined && closedAt !== null && (typeof closedAt !== 'string' || Number.isNaN(Date.parse(closedAt)))) {
    return invalid;
  }
  if (!Array.isArray(options) || options.length < 2 || options.length > 8) return invalid;
  let sum = 0;
  for (const option of options as Array<Record<string, unknown> | null>) {
    const label = option?.label;
    const votes = option?.votes;
    if (typeof label !== 'string' || label.trim() === '' || label.length > 120) return invalid;
    if (typeof votes !== 'number' || !Number.isInteger(votes) || votes < 0 || votes > 10_000_000) return invalid;
    sum += votes;
  }
  if (total !== sum) return invalid;
  return null;
}

/** Texte brut du document, un bloc par ligne (comptage de mots, extraits). */
export function docPlainText(doc: BlogDoc | BlogNode): string {
  const parts: string[] = [];
  const walk = (node: BlogNode) => {
    if (node.type === 'text' && typeof node.text === 'string') {
      parts.push(node.text);
      return;
    }
    if (node.type === 'hardBreak') {
      parts.push(' ');
      return;
    }
    for (const child of node.content ?? []) walk(child);
    if (node.type !== 'doc' && node.type !== 'text') parts.push('\n');
  };
  walk(doc as BlogNode);
  return parts.join('').replace(/[ \t]+\n/g, '\n').replace(/\n{2,}/g, '\n').trim();
}

export function countWords(text: string): number {
  const words = text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu);
  return words ? words.length : 0;
}

/** Temps de lecture en minutes, à 230 mots par minute, jamais moins d'une minute. */
export function readingMinutes(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / 230));
}
