import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildPreviewUrl, PREVIEW_TTL_SECONDS, signPreview } from './preview';

const ID = '7f0c2b1e-6a43-4c55-9d0e-2f6b8a1c3d4e';

test('le lien d’aperçu porte l’échéance à 24 h et une signature vérifiable', () => {
  const now = Date.parse('2026-11-26T12:00:00Z');
  const url = new URL(buildPreviewUrl('https://bento-pop.com/', ID, 'secret', now));
  assert.equal(url.origin + url.pathname, `https://bento-pop.com/blog/apercu/${ID}`);
  const exp = Number(url.searchParams.get('exp'));
  assert.equal(exp, now / 1000 + PREVIEW_TTL_SECONDS);
  assert.equal(url.searchParams.get('sig'), signPreview(ID, exp, 'secret'));
});

test('la signature change avec l’article, l’échéance et le secret', () => {
  const base = signPreview(ID, 100, 'secret');
  assert.notEqual(signPreview(ID.replace('7', '8'), 100, 'secret'), base);
  assert.notEqual(signPreview(ID, 101, 'secret'), base);
  assert.notEqual(signPreview(ID, 100, 'autre'), base);
  // Valeur figée : la landing calcule la même avec Web Crypto (cf. son test).
  assert.equal(base, 'GhGxObyoBjabkSIJwS75i6T3ZnCpxlJWyRELetqY8ww');
});
