/**
 * Allowlist des hôtes dont les images passent par l'optimiseur `next/image`.
 *
 * ⚠️ Doit rester synchronisée avec `images.remotePatterns` dans
 * `next.config.ts`. La duplication est volontaire : le loader de config Next
 * ne résout pas l'alias `@/`, et un import relatif depuis `next.config.ts`
 * fragiliserait le build pour trois lignes.
 *
 * Toute URL hors allowlist (ex. `cover_url` d'une mention, saisi librement
 * dans le BO) retombe sur un `<img>` classique dans `SmartImage`, sinon
 * `next/image` throw en runtime et casse la page entière.
 */

/** Miniatures YouTube (`youtubeThumbnail()` dans `lib/episodes.ts`). */
const YOUTUBE_IMAGE_HOSTS = ['i.ytimg.com', 'img.youtube.com'] as const;

/**
 * Illustrations du catalogue mobile (`items.image_url`), affichées par la
 * page publique `/u/[pseudo]`. Les items récents sont hébergés sur le
 * Storage du projet mobile, mais les items historiques pointent encore
 * vers les APIs externes d'origine. Relevé de production du 11 septembre
 * 2026 : 82 affiches TMDb, 5 photos Wikimedia, 1 pochette MusicBrainz.
 */
const CATALOG_IMAGE_HOSTS = [
  'image.tmdb.org',
  'upload.wikimedia.org',
  'coverartarchive.org',
] as const;

function hostnameOf(rawUrl: string | undefined): string | null {
  if (!rawUrl) return null;
  try {
    return new URL(rawUrl).hostname;
  } catch {
    return null;
  }
}

/**
 * Storage du projet Supabase landing (photos d'équipe, miniatures d'épisodes)
 * et du projet mobile (illustrations du catalogue `items`, affichées par
 * `/u/[pseudo]`). Deux `project-ref` distincts, donc deux hostnames.
 *
 * Les deux `process.env.NEXT_PUBLIC_*` sont lus en accès direct à la
 * propriété, et pas via une variable ou une boucle : c'est ce qui permet à
 * Next d'inliner la valeur au build dans le bundle client.
 */
const OPTIMIZABLE_HOSTS: ReadonlySet<string> = new Set(
  [
    hostnameOf(process.env.NEXT_PUBLIC_SUPABASE_URL),
    hostnameOf(process.env.NEXT_PUBLIC_MOBILE_SUPABASE_URL),
    ...YOUTUBE_IMAGE_HOSTS,
    ...CATALOG_IMAGE_HOSTS,
  ].filter((host): host is string => Boolean(host)),
);

/**
 * `true` si l'URL peut être servie par l'optimiseur Next (asset local ou
 * hôte connu), `false` s'il faut retomber sur un `<img>` brut.
 */
export function isOptimizableImage(src: string): boolean {
  // Assets locaux (`/_next/static/media/…` issus des imports du package brand)
  // et fichiers de `public/` : pas de remotePattern nécessaire.
  if (src.startsWith('/')) return true;
  try {
    const url = new URL(src);
    // `remotePatterns` n'accepte que le https : une adresse http d'un hôte connu ferait
    // lever `next/image` et tomber toute la page. Elle passe donc par le `<img>` brut.
    return url.protocol === 'https:' && OPTIMIZABLE_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}
