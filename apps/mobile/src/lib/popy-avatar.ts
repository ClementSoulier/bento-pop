import popyContent from '@bento-pop/brand/assets/mascot/popy-content.png';
import popyDiable from '@bento-pop/brand/assets/mascot/popy-diable.png';
import popyFille from '@bento-pop/brand/assets/mascot/popy-fille.png';
import popyGene from '@bento-pop/brand/assets/mascot/popy-gene.png';
import popyIntello from '@bento-pop/brand/assets/mascot/popy-intello.png';
import popyNani from '@bento-pop/brand/assets/mascot/popy-nani.png';

/**
 * Avatar Popy déterministe par pseudo.
 *
 * On hash le pseudo en lowercase pour obtenir un index stable parmi nos
 * 6 variantes. Même pseudo → même Popy partout, sans avoir besoin d'une
 * colonne DB dédiée. À la v2 (claim avec password), on pourra ajouter
 * `users.avatar` pour permettre le choix manuel.
 */

const POPYS = [
  { key: 'content', source: popyContent, accent: '#fbbf24' },
  { key: 'intello', source: popyIntello, accent: '#3b82a8' },
  { key: 'fille', source: popyFille, accent: '#ff5588' },
  { key: 'gene', source: popyGene, accent: '#8b5cf6' },
  { key: 'nani', source: popyNani, accent: '#2ec4b6' },
  { key: 'diable', source: popyDiable, accent: '#e63946' },
] as const;

/** Hash naïf type djb2 — déterministe, suffisant pour distribuer 6 variantes. */
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function popyForPseudo(pseudo: string): (typeof POPYS)[number] {
  const idx = hashString(pseudo.toLowerCase()) % POPYS.length;
  return POPYS[idx] ?? POPYS[0]!;
}
