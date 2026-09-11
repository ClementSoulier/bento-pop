/**
 * Analyse de couverture de glyphes et normalisation typographique.
 *
 * Séparé de `fonts.ts`, qui porte les entrées-sorties et le marqueur
 * `server-only` : ces fonctions-ci sont pures, et doivent rester
 * importables par le runner de tests.
 *
 * Satori n'a aucune police système. Tout glyphe absent des tampons fournis
 * est rendu en carré vide, y compris dans une image de partage.
 */

// ─── Couverture ────────────────────────────────────────────────────────

let coverage: Set<number> | null = null;

/**
 * Points de code présents dans la table `cmap` de la police.
 *
 * On lit la table plutôt que de coder en dur une liste de plages : la
 * police peut être remplacée, et une liste figée deviendrait fausse en
 * silence. Seuls les formats 4 (BMP) et 12 (plan étendu) sont traités,
 * les deux seuls qu'utilisent les polices modernes.
 */
export function coveredCodePoints(font: Buffer): Set<number> {
  if (coverage) return coverage;
  const covered = new Set<number>();
  try {
    const dv = new DataView(font.buffer, font.byteOffset, font.byteLength);
    const tableCount = dv.getUint16(4);
    let cmap = 0;
    for (let i = 0; i < tableCount; i++) {
      const entry = 12 + i * 16;
      const tag = String.fromCharCode(
        dv.getUint8(entry),
        dv.getUint8(entry + 1),
        dv.getUint8(entry + 2),
        dv.getUint8(entry + 3),
      );
      if (tag === 'cmap') cmap = dv.getUint32(entry + 8);
    }
    if (!cmap) return (coverage = covered);

    const subtables = dv.getUint16(cmap + 2);
    for (let i = 0; i < subtables; i++) {
      const sub = cmap + dv.getUint32(cmap + 4 + i * 8 + 4);
      const format = dv.getUint16(sub);
      if (format === 4) {
        const segCountX2 = dv.getUint16(sub + 6);
        const endOffset = sub + 14;
        const startOffset = endOffset + segCountX2 + 2;
        for (let s = 0; s < segCountX2 / 2; s++) {
          const end = dv.getUint16(endOffset + s * 2);
          const start = dv.getUint16(startOffset + s * 2);
          if (start === 0xffff) continue;
          for (let c = start; c <= end; c++) covered.add(c);
        }
      } else if (format === 12) {
        const groups = dv.getUint32(sub + 12);
        for (let g = 0; g < groups; g++) {
          const o = sub + 16 + g * 12;
          const start = dv.getUint32(o);
          const end = dv.getUint32(o + 4);
          // Garde-fou : une plage aberrante ne doit pas faire exploser la
          // mémoire pendant la génération d'une image.
          for (let c = start; c <= end && c - start < 10_000; c++) covered.add(c);
        }
      }
    }
  } catch {
    // Police illisible : on considère tout comme couvert plutôt que de
    // déclencher un téléchargement de repli pour chaque caractère.
    return (coverage = new Set());
  }
  return (coverage = covered);
}

// ─── Normalisation ─────────────────────────────────────────────────────

/**
 * Remplace les caractères typographiques par leur équivalent couvert.
 *
 * Corrige sans réseau les cas les plus fréquents : les différentes formes
 * de tirets et de guillemets que les APIs sources injectent dans les
 * titres. `C‐C‐C` (tiret U+2010) devient `C-C-C`.
 *
 * Les classes sont écrites en séquences d'échappement plutôt qu'en
 * littéral : plusieurs de ces caractères sont des espaces invisibles à la
 * relecture, et un tiret cadratin ne se distingue pas d'un demi-cadratin
 * dans un éditeur.
 */
const SUBSTITUTIONS: ReadonlyArray<[RegExp, string]> = [
  // Tirets typographiques U+2010 à U+2015.
  [/[\u2010-\u2015]/g, '-'],
  // Apostrophes et guillemets simples typographiques.
  [/[\u2018\u2019\u201A\u201B]/g, "'"],
  // Guillemets doubles typographiques.
  [/[\u201C\u201D\u201E\u201F]/g, '"'],
  // Points de suspension en un seul caractère.
  [/\u2026/g, '...'],
  // Espace insécable, espace fine, espace insécable étroite.
  [/[\u00A0\u2009\u202F]/g, ' '],
];

export function normalizeForOg(text: string): string {
  return SUBSTITUTIONS.reduce((acc, [re, to]) => acc.replace(re, to), text);
}

/** Caractères d'un texte absents de la police, hors espaces et sauts. */
export function missingGlyphs(texts: readonly string[], covered: Set<number>): string {
  if (covered.size === 0) return '';
  const missing = new Set<string>();
  for (const text of texts) {
    for (const char of normalizeForOg(text)) {
      const code = char.codePointAt(0);
      if (code === undefined || code < 0x20) continue;
      if (!covered.has(code)) missing.add(char);
    }
  }
  return [...missing].join('');
}
