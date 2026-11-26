import assert from 'node:assert/strict';
import { test } from 'node:test';

import { verifyPreview } from './preview';

const ID = '7f0c2b1e-6a43-4c55-9d0e-2f6b8a1c3d4e';
// Signature figée calculée par l'admin (apps/admin/src/lib/blog/preview.test.ts) pour exp = 100.
const SIG_100 = 'GhGxObyoBjabkSIJwS75i6T3ZnCpxlJWyRELetqY8ww';
const AT_50 = 50_000;

test('la signature de l’admin est acceptée avant l’échéance', () => {
  assert.equal(verifyPreview(ID, '100', SIG_100, 'secret', AT_50), true);
});

test('refus : échéance passée, trop lointaine, autre article, autre secret, signature absente', () => {
  assert.equal(verifyPreview(ID, '100', SIG_100, 'secret', 101_000), false);
  assert.equal(verifyPreview(ID, '100', SIG_100, 'secret', 100_000 - 26 * 3600 * 1000), false);
  assert.equal(verifyPreview(ID.replace('7', '8'), '100', SIG_100, 'secret', AT_50), false);
  assert.equal(verifyPreview(ID, '100', SIG_100, 'autre', AT_50), false);
  assert.equal(verifyPreview(ID, '100', undefined, 'secret', AT_50), false);
  assert.equal(verifyPreview(ID, '100', SIG_100.slice(0, -2), 'secret', AT_50), false);
  assert.equal(verifyPreview(ID, '1e2', SIG_100, 'secret', AT_50), false);
});

test('sans secret configuré, aucun aperçu n’est servi', () => {
  assert.equal(verifyPreview(ID, '100', SIG_100, undefined, AT_50), false);
  assert.equal(verifyPreview(ID, '100', SIG_100, '', AT_50), false);
});
