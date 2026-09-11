import 'server-only';

/**
 * Pré-chargement des illustrations pour l'image Open Graph.
 *
 * Satori sait télécharger une `<img src="https://…">` lui-même, mais sans
 * délai maximal que l'on contrôle. Or une image lente est pire qu'une
 * image absente : le robot d'aperçu abandonne au bout de quelques
 * secondes et le lien s'affiche nu. On télécharge donc nous-mêmes, en
 * parallèle, avec un délai serré, et on passe des URL de données.
 */

const IMAGE_TIMEOUT_MS = 2000;

/** Au-delà, on renonce : une illustration lourde ne vaut pas l'aperçu. */
const MAX_IMAGE_BYTES = 2_000_000;

const ALLOWED_HOSTS = new Set([
  'image.tmdb.org',
  'upload.wikimedia.org',
  'coverartarchive.org',
]);

function isAllowed(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== 'https:') return false;
    if (ALLOWED_HOSTS.has(hostname)) return true;
    // Storage du projet mobile, dont l'hôte dépend du `project-ref`.
    return hostname.endsWith('.supabase.co');
  } catch {
    return false;
  }
}

async function toDataUrl(url: string): Promise<string | null> {
  if (!isAllowed(url)) return null;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
      // Les chemins sont stables (UUID côté Storage, hash côté TMDb) :
      // une même URL ne change jamais de contenu.
      next: { revalidate: 60 * 60 * 24 * 30 },
    });
    if (!res.ok) return null;

    const type = res.headers.get('content-type') ?? 'image/jpeg';
    if (!type.startsWith('image/')) return null;

    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > MAX_IMAGE_BYTES) return null;

    return `data:${type};base64,${Buffer.from(buffer).toString('base64')}`;
  } catch {
    return null;
  }
}

/**
 * Télécharge en parallèle et renvoie une table URL d'origine → URL de
 * données. Toute image en échec est simplement absente de la table :
 * l'appelant retombe alors sur le dégradé de la palette, comme pour un
 * item sans illustration.
 */
export async function prefetchImages(
  urls: readonly (string | null)[],
): Promise<Map<string, string>> {
  const unique = [...new Set(urls.filter((u): u is string => Boolean(u)))];
  const results = await Promise.allSettled(
    unique.map(async (url) => [url, await toDataUrl(url)] as const),
  );

  const map = new Map<string, string>();
  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    const [url, dataUrl] = result.value;
    if (dataUrl) map.set(url, dataUrl);
  }
  return map;
}
