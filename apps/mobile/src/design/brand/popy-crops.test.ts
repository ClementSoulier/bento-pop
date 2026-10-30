import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { inflateSync } from 'node:zlib';
import { POPY_CROPS, POPY_SOURCE_SIDE, type PopyFile } from './popy-crops';

const MASCOT = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  'packages',
  'brand',
  'assets',
  'mascot',
);

/** L'opacité de chaque pixel d'un PNG RGBA de 8 bits non entrelacé, le format des originaux. */
function alphaOf(path: string): { width: number; height: number; alpha: Uint8Array } {
  const png = readFileSync(path);
  let width = 0;
  let height = 0;
  const chunks: Buffer[] = [];
  for (let offset = 8; offset < png.length; ) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('latin1', offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      assert.deepEqual([data[8], data[9], data[12]], [8, 6, 0], `${path} : RGBA 8 bits`);
    } else if (type === 'IDAT') chunks.push(data);
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * 4;
  const alpha = new Uint8Array(width * height);
  let previous = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const start = y * (stride + 1);
    const filter = raw[start] ?? 0;
    const line = new Uint8Array(stride);
    for (let i = 0; i < stride; i++) {
      const left = i >= 4 ? (line[i - 4] ?? 0) : 0;
      const up = previous[i] ?? 0;
      const upLeft = i >= 4 ? (previous[i - 4] ?? 0) : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const [pa, pb, pc] = [Math.abs(p - left), Math.abs(p - up), Math.abs(p - upLeft)];
        predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      }
      line[i] = ((raw[start + 1 + i] ?? 0) + predictor) & 0xff;
    }
    for (let x = 0; x < width; x++) alpha[y * width + x] = line[x * 4 + 3] ?? 0;
    previous = line;
  }
  return { width, height, alpha };
}

/** Le carré du dessin : la plus grande dimension des pixels opaques, centrée sur eux. */
function squareOf(file: PopyFile) {
  const { width, height, alpha } = alphaOf(join(MASCOT, `popy-${file}.png`));
  let [left, top, right, bottom] = [width, height, 0, 0];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((alpha[y * width + x] ?? 0) <= 8) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x + 1);
      bottom = Math.max(bottom, y + 1);
    }
  }
  const side = Math.max(right - left, bottom - top);
  return {
    width,
    height,
    crop: { x: (left + right - side) / 2, y: (top + bottom - side) / 2, side },
  };
}

describe('le cadrage de Popy', () => {
  for (const file of Object.keys(POPY_CROPS) as PopyFile[]) {
    it(`cadre le dessin de popy-${file}.png comme les découpes du dossier`, () => {
      const { width, height, crop } = squareOf(file);
      assert.deepEqual([width, height], [POPY_SOURCE_SIDE, POPY_SOURCE_SIDE]);
      assert.deepEqual(POPY_CROPS[file], crop);
    });
  }
});
