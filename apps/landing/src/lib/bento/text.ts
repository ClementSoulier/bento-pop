/**
 * Helpers d'affichage du bento public.
 *
 * Portage de `apps/mobile/src/lib/text.ts`, à comportement identique : un
 * titre doit se lire exactement pareil dans l'app, sur la page web et dans
 * l'image de partage. Le test `text.test.ts` verrouille la parité.
 */

/**
 * Nettoie un titre pour l'affichage.
 *
 * 1. Retire les parenthèses et leur contenu. Les APIs sources en collent
 *    beaucoup pour désambiguïser (« Inception (film) », « Lumière (from
 *    Californication) »), ce qui n'a pas sa place sur une tuile.
 * 2. Idem pour les crochets (« [edit] » de Wikipedia).
 * 3. Réduit les espaces multiples.
 * 4. Si `maxLen` est fourni et dépassé, tronque à une frontière de mot avec
 *    une ellipsis, plutôt que de couper en plein milieu.
 *
 * Les parenthèses non refermées sont traitées aussi : certaines sources
 * renvoient des titres tronqués du type « Foo (incomplete ».
 */
export function cleanTitle(raw: string, maxLen?: number): string {
  if (!raw) return '';

  let s = raw.replace(/\s*\([^)]*\)?/g, '').trim();
  s = s.replace(/\s*\[[^\]]*\]?/g, '').trim();
  s = s.replace(/\s+/g, ' ');

  if (!maxLen || s.length <= maxLen) return s;

  const sliced = s.slice(0, maxLen - 1);
  const lastSpace = sliced.lastIndexOf(' ');
  const cut = lastSpace > maxLen * 0.5 ? sliced.slice(0, lastSpace) : sliced;
  return `${trimTrailingSeparators(cut)}…`;
}

/**
 * Retire les séparateurs de fin avant d'ajouter l'ellipsis.
 *
 * Sans ça, « FR · Person · French rapper » tronqué donne
 * « FR · Person ·… », qui se lit comme une erreur. Les sous-titres du
 * catalogue sont souvent des énumérations séparées par des points médians.
 */
function trimTrailingSeparators(text: string): string {
  return text.replace(/[\s·,;:/|·–—-]+$/u, '');
}

/**
 * Initiale affichée en filigrane sur une tuile sans illustration.
 *
 * Cherche le premier caractère alphanumérique plutôt que de prendre
 * `[0]` : beaucoup de titres commencent par une ponctuation, un guillemet
 * ou une espace, et un `«` en filigrane géant ne veut rien dire.
 *
 * `\p{L}` et `\p{N}` avec le drapeau `u` plutôt qu'une plage `A-Za-z` :
 * le catalogue contient des titres japonais (`稲葉曇`, `ロストアンブレラ`)
 * dont l'app mobile affiche aujourd'hui un `?` faute de correspondance.
 */
export function initialOf(raw: string): string {
  const match = raw.trim().match(/[\p{L}\p{N}]/u);
  return (match?.[0] ?? '?').toLocaleUpperCase('fr-FR');
}

/**
 * Tronque une phrase à `maxLen` caractères sans couper de mot, pour les
 * balises `description` et `og:description`.
 *
 * Google tronque autour de 155 à 160 caractères et les scrapers sociaux
 * coupent souvent plus court ; mieux vaut maîtriser la coupe que la subir.
 */
export function truncateAtWord(text: string, maxLen: number): string {
  const s = text.replace(/\s+/g, ' ').trim();
  if (s.length <= maxLen) return s;

  const sliced = s.slice(0, maxLen - 1);
  const lastSpace = sliced.lastIndexOf(' ');
  const cut = lastSpace > maxLen * 0.5 ? sliced.slice(0, lastSpace) : sliced;
  return `${trimTrailingSeparators(cut)}…`;
}

/**
 * Liste lisible à la française : « A, B et C ».
 * Utilisée pour composer la description à partir des titres des cases.
 */
export function joinReadable(parts: readonly string[]): string {
  const clean = parts.filter((p) => p.trim().length > 0);
  if (clean.length === 0) return '';
  if (clean.length === 1) return clean[0] ?? '';
  return `${clean.slice(0, -1).join(', ')} et ${clean[clean.length - 1]}`;
}
