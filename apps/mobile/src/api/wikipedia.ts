/**
 * Client Wikipedia REST API — récupération de la vignette d'une page.
 *
 * Utilisé pour enrichir les résultats de recherche des catégories sans image
 * native (artiste / créateur / lieu) avec une photo Wikipedia quand
 * disponible. Gratuit, pas d'auth, rate-limit large (~200 req/s).
 *
 * Doc : https://www.mediawiki.org/wiki/Wikimedia_REST_API
 */

const USER_AGENT = 'BentoPop/0.1 (https://bento-pop.com)';

type WikipediaSummary = {
  type?: 'standard' | 'disambiguation' | 'no-extract';
  title?: string;
  thumbnail?: { source: string; width: number; height: number };
  originalimage?: { source: string; width: number; height: number };
};

/**
 * Cherche la vignette Wikipedia d'un titre donné. Essaie fr d'abord, puis en
 * en fallback. Skip les pages de désambiguïsation.
 *
 * Retourne `null` si pas trouvé ou si le fetch échoue — c'est volontaire,
 * l'absence d'image n'est pas une erreur bloquante (le tile fallback prend
 * le relais). Pas de timeout custom : le fetch RN respecte le timeout réseau
 * système (~30s, mais une recherche normale prend <500ms).
 */
export async function fetchWikipediaThumbnail(title: string): Promise<string | null> {
  if (!title.trim()) return null;
  for (const lang of ['fr', 'en'] as const) {
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.trim())}`;
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
        },
      });
      if (!res.ok) continue; // 404 → next lang
      const data = (await res.json()) as WikipediaSummary;
      if (data.type === 'disambiguation') continue; // page ambiguë → next lang
      if (data.thumbnail?.source) return data.thumbnail.source;
    } catch {
      // Erreur réseau / parsing → next lang
    }
  }
  return null;
}

