/**
 * Helpers de traitement de texte affiché — centralisés pour rester cohérents
 * entre Tile / MiniBentoCard / search-modal / ShareImage.
 */

/**
 * Nettoie un titre pour affichage :
 *   1. Retire les parties entre parenthèses (Wikipedia/MB en collent souvent
 *      pour préciser : "Lumière (from Californication)", "Inception (film)" …).
 *      Garde le titre principal lisible.
 *   2. Trim + collapse les espaces multiples.
 *   3. Si `maxLen` fourni et que le résultat dépasse, tronque à un mot
 *      boundary avec une ellipsis Unicode (…) plutôt que de couper en plein
 *      milieu d'un mot.
 *
 * Exemples :
 *   - "LUMIÈRE (FROM CALIFORNICATION)" → "LUMIÈRE"
 *   - "Breaking Bad" → "Breaking Bad"
 *   - "Quentin Dupieux (réalisateur français)" → "Quentin Dupieux"
 *   - cleanTitle("A very long song title that overflows", 20) → "A very long song…"
 */
export function cleanTitle(raw: string, maxLen?: number): string {
  if (!raw) return '';

  // Strip parentheses (et leur contenu) — gourmand sur la parenthèse non
  // fermée aussi (ex : tronqué côté API qui renvoie "Foo (incomplete").
  let s = raw.replace(/\s*\([^)]*\)?/g, '').trim();
  // Idem pour les crochets (Wikipedia met parfois "[edit]" ou disambig).
  s = s.replace(/\s*\[[^\]]*\]?/g, '').trim();
  // Collapse espaces multiples
  s = s.replace(/\s+/g, ' ');

  if (!maxLen || s.length <= maxLen) return s;

  // Tronque à un word boundary : on coupe au dernier espace AVANT maxLen-1
  // (pour laisser la place à l'ellipsis).
  const sliced = s.slice(0, maxLen - 1);
  const lastSpace = sliced.lastIndexOf(' ');
  const cut = lastSpace > maxLen * 0.5 ? sliced.slice(0, lastSpace) : sliced;
  return `${cut.trimEnd()}…`;
}
