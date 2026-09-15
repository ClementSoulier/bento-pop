import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  EXTENDA_ADVANCES,
  EXTENDA_UNITS_PER_EM,
  EXTENDA_WIDEST,
  extendaTextWidth,
} from './extenda-metrics';

/**
 * La table des largeurs, relue dans le fichier de la police : une police
 * mise à jour sans la table ferait mesurer les titres à côté, sans que rien
 * ne le signale à l'écran.
 */

const FONT_PATH = join(
  __dirname,
  ...['..', '..', '..', '..', '..'],
  'packages/brand/assets/fonts/extenda-100-yotta.otf',
);

type FontMetrics = {
  unitsPerEm: number;
  /** Point de code → avance horizontale, en unités de la grille. */
  advances: Map<number, number>;
  /** Valeurs des paires de crénage de la table `kern`, format 0. */
  kerning: number[];
};

/** Lecture minimale d'un OpenType : `head`, `hhea`, `hmtx`, `cmap` format 4, `kern` format 0. */
function readFont(path: string): FontMetrics {
  const font = readFileSync(path);
  const tables = new Map<string, number>();
  for (let i = 0; i < font.readUInt16BE(4); i += 1) {
    const record = 12 + 16 * i;
    tables.set(font.toString('latin1', record, record + 4), font.readUInt32BE(record + 8));
  }
  const table = (tag: string): number => {
    const offset = tables.get(tag);
    assert.ok(offset !== undefined, `table ${tag} absente`);
    return offset;
  };

  const unitsPerEm = font.readUInt16BE(table('head') + 18);
  const metricsCount = font.readUInt16BE(table('hhea') + 34);
  const advanceOf = (glyph: number) =>
    font.readUInt16BE(table('hmtx') + 4 * Math.min(glyph, metricsCount - 1));

  const cmap = table('cmap');
  let unicode: number | undefined;
  for (let i = 0; i < font.readUInt16BE(cmap + 2); i += 1) {
    const record = cmap + 4 + 8 * i;
    const subtable = cmap + font.readUInt32BE(record + 4);
    const windowsUnicode = font.readUInt16BE(record) === 3 && font.readUInt16BE(record + 2) === 1;
    if (windowsUnicode && font.readUInt16BE(subtable) === 4) unicode = subtable;
  }
  assert.ok(unicode !== undefined, 'cmap Unicode au format 4 absente');
  const segments = font.readUInt16BE(unicode + 6) / 2;
  const ends = unicode + 14;
  const starts = ends + 2 * segments + 2;
  const deltas = starts + 2 * segments;
  const rangeOffsets = deltas + 2 * segments;
  const advances = new Map<number, number>();
  for (let s = 0; s < segments; s += 1) {
    const start = font.readUInt16BE(starts + 2 * s);
    const end = font.readUInt16BE(ends + 2 * s);
    const delta = font.readInt16BE(deltas + 2 * s);
    const rangeOffset = font.readUInt16BE(rangeOffsets + 2 * s);
    for (let code = start; code <= end && code !== 0xffff; code += 1) {
      let glyph = code + delta;
      if (rangeOffset !== 0) {
        const indexed = font.readUInt16BE(rangeOffsets + 2 * s + rangeOffset + 2 * (code - start));
        glyph = indexed === 0 ? 0 : indexed + delta;
      }
      glyph &= 0xffff;
      if (glyph !== 0) advances.set(code, advanceOf(glyph));
    }
  }

  const kerning: number[] = [];
  const kern = table('kern');
  let subtable = kern + 4;
  for (let i = 0; i < font.readUInt16BE(kern + 2); i += 1) {
    const length = font.readUInt16BE(subtable + 2);
    if (font.readUInt16BE(subtable + 4) >> 8 === 0) {
      for (let p = 0; p < font.readUInt16BE(subtable + 6); p += 1) {
        kerning.push(font.readInt16BE(subtable + 14 + 6 * p + 4));
      }
    }
    subtable += length;
  }
  return { unitsPerEm, advances, kerning };
}

/** Les écritures qu'un titre en capitales peut afficher, cf. `extenda-metrics.ts`. */
const TITLE_RANGES: [number, number][] = [
  [0x20, 0x7e],
  [0xa1, 0x24f],
  [0x370, 0x3ff],
  [0x400, 0x4ff],
  [0x1e00, 0x1eff],
  [0x2010, 0x205e],
  [0x20a0, 0x20cf],
  [0x2122, 0x2122],
];

/** Un caractère qu'un titre en capitales affiche tel quel : ni minuscule, ni marque, ni contrôle. */
function shownInCapitals(char: string): boolean {
  if (char.toUpperCase() !== char) return false;
  if (/[\p{M}\p{C}]/u.test(char)) return false;
  return char === ' ' || !/\p{Zs}/u.test(char);
}

describe('largeurs d’Extenda', () => {
  const font = readFont(FONT_PATH);

  it('reprend la grille de la police', () => {
    assert.equal(font.unitsPerEm, EXTENDA_UNITS_PER_EM);
  });

  it('donne à chaque caractère la largeur du fichier', () => {
    const wrong = [...EXTENDA_ADVANCES].filter(
      ([char, width]) => font.advances.get(char.codePointAt(0) ?? -1) !== width,
    );
    assert.deepEqual(wrong, []);
  });

  it('couvre tout ce qu’un titre en capitales peut afficher dans la police', () => {
    const missing = [...font.advances.keys()]
      .filter((code) => TITLE_RANGES.some(([from, to]) => from <= code && code <= to))
      .map((code) => String.fromCodePoint(code))
      .filter((char) => shownInCapitals(char) && !EXTENDA_ADVANCES.has(char));
    assert.deepEqual(missing, []);
  });

  it('prête à un caractère absent la largeur du plus large glyphe de la police', () => {
    assert.equal(EXTENDA_WIDEST, Math.max(...font.advances.values()));
    assert.equal(extendaTextWidth('★', 10, 0), (EXTENDA_WIDEST / EXTENDA_UNITS_PER_EM) * 10);
  });

  /** Ce qui fait de la mesure sans crénage une majoration. */
  it('ne crène qu’en resserrant', () => {
    assert.equal(font.kerning.length, 10_920);
    assert.equal(font.kerning.filter((value) => value > 0).length, 0);
  });
});

describe('extendaTextWidth', () => {
  it('additionne les glyphes à la taille demandée, et l’espacement pour chaque caractère', () => {
    // S 1428, O 1610, N 1521, sur 2 048 par em.
    assert.equal(extendaTextWidth('SON', 2048, 0), 1428 + 1610 + 1521);
    assert.equal(extendaTextWidth('SON', 2048, 1), 1428 + 1610 + 1521 + 3);
  });

  it('compte espaces insécables et traits d’union Unicode comme leurs voisins d’Extenda', () => {
    assert.equal(extendaTextWidth('A\u00a0B', 12, 0.5), extendaTextWidth('A B', 12, 0.5));
    assert.equal(extendaTextWidth('C\u2010C', 12, 0.5), extendaTextWidth('C-C', 12, 0.5));
  });

  /** Mesuré sur un iPhone 17 Pro : « MEGALOVA » tenait dans une ligne de 73,35 pt. */
  it('majore le rendu mesuré', () => {
    assert.ok(extendaTextWidth('MEGALOVA', 12, 0.5) > 73.35);
  });
});
