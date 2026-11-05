import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  TAG_LABEL_ADVANCES,
  TILE_TITLE_ADVANCES,
  tagLabelWidth,
  tileTitleWidth,
} from './tile-metrics';

/**
 * Les tables de largeurs, relues dans les fichiers de police : une police mise
 * à jour sans sa table ferait mesurer les titres à côté, sans que rien ne le
 * signale à l'écran.
 */
const ROOT = join(__dirname, ...['..', '..', '..', '..', '..']);
const TILE_FONT = join(ROOT, 'apps/mobile/assets/fonts/FredokaSemiCondensed-Bold.ttf');
const TAG_FONT = join(
  ROOT,
  'node_modules/.pnpm/@expo-google-fonts+fredoka@0.4.1/node_modules/@expo-google-fonts/fredoka/600SemiBold/Fredoka_600SemiBold.ttf',
);

/** Lecture minimale d'un TrueType : `head`, `hhea`, `hmtx`, `cmap` format 4. */
function readAdvances(path: string): { unitsPerEm: number; advances: Map<number, number> } {
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
  return { unitsPerEm, advances };
}

describe('les largeurs du bento', () => {
  for (const [name, path, groups] of [
    ['les titres', TILE_FONT, TILE_TITLE_ADVANCES],
    ['les puces', TAG_FONT, TAG_LABEL_ADVANCES],
  ] as const) {
    it(`relues dans la police, pour ${name}`, () => {
      const { unitsPerEm, advances } = readAdvances(path);
      for (const [chars, em] of groups) {
        for (const char of chars) {
          const advance = advances.get(char.codePointAt(0) ?? 0);
          assert.ok(advance !== undefined, `${char} absent de ${path}`);
          assert.ok(
            Math.abs(advance / unitsPerEm - em) < 0.001,
            `${char} : ${advance} contre ${em}`,
          );
        }
      }
    });
  }

  it('mesure en capitales, approche comprise', () => {
    assert.equal(tileTitleWidth('a', 10, 0), tileTitleWidth('A', 10, 0));
    assert.ok(Math.abs(tileTitleWidth('AA', 10, 1) - (2 * tileTitleWidth('A', 10, 0) + 2)) < 1e-9);
    assert.equal(tagLabelWidth('é', 10, 0), tagLabelWidth('É', 10, 0));
  });

  it('compte une espace insécable comme une espace', () => {
    assert.equal(tileTitleWidth('A B', 10, 0), tileTitleWidth('A B', 10, 0));
  });

  it('compte large un caractère hors de la table : il viendra d’une autre police', () => {
    assert.equal(tileTitleWidth('★', 10, 0), 10);
  });
});
