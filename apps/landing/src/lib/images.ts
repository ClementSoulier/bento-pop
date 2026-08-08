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

function readSupabaseHost(): string | null {
  // Accès direct à la propriété : c'est ce qui permet à Next d'inliner la
  // valeur au build dans le bundle client.
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

const OPTIMIZABLE_HOSTS: ReadonlySet<string> = new Set(
  [readSupabaseHost(), ...YOUTUBE_IMAGE_HOSTS].filter((host): host is string => Boolean(host)),
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
    return OPTIMIZABLE_HOSTS.has(new URL(src).hostname);
  } catch {
    return false;
  }
}
