import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { NEWSLETTER_PUBLIC_IMAGES, pngWidth } from './public-images';

const PUBLIC_DIR = path.join(process.cwd(), 'public');

describe('images fixes de la newsletter', () => {
  for (const image of NEWSLETTER_PUBLIC_IMAGES) {
    it(`${image.path} est un PNG de ${image.width} px de large`, () => {
      const bytes = readFileSync(path.join(PUBLIC_DIR, image.path));
      assert.equal(pngWidth(bytes), image.width);
      // Un mail lourd s'affiche mal : chaque image reste sous 80 Ko.
      assert.ok(bytes.length < 80_000, `${image.path} pèse ${bytes.length} octets`);
    });
  }

  it('reconnaît ce qui n’est pas un PNG', () => {
    assert.equal(pngWidth(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>')), null);
  });
});
