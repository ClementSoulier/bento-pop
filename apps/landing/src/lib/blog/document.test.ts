import assert from 'node:assert/strict';
import { test } from 'node:test';

import { asBlogDoc, headingAnchor, safeLink, youtubeIdFromUrl } from './document';

test('liens : seuls http(s), mailto, chemins et ancres sont rendus', () => {
  assert.deepEqual(safeLink('https://example.com/a'), { href: 'https://example.com/a', external: true });
  assert.deepEqual(safeLink('/emissions/ep-1'), { href: '/emissions/ep-1', external: false });
  assert.deepEqual(safeLink('#intro'), { href: '#intro', external: false });
  assert.deepEqual(safeLink('mailto:contact@bento-pop.com'), {
    href: 'mailto:contact@bento-pop.com',
    external: false,
  });
  for (const refuse of ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,x', '//evil.test/x', '', null, 3]) {
    assert.equal(safeLink(refuse), null, String(refuse));
  }
});

test('un lien absolu vers bento-pop.com devient un chemin interne', () => {
  assert.deepEqual(safeLink('https://bento-pop.com/podcasts/x?y=1#z'), {
    href: '/podcasts/x?y=1#z',
    external: false,
  });
  assert.deepEqual(safeLink('https://www.bento-pop.com'), { href: '/', external: false });
});

test('YouTube : identifiant reconnu, hôtes étrangers refusés', () => {
  assert.equal(youtubeIdFromUrl('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youtubeIdFromUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youtubeIdFromUrl('https://youtube.evil.test/watch?v=dQw4w9WgXcQ'), null);
  assert.equal(youtubeIdFromUrl('https://www.youtube.com/watch?v=<script>'), null);
});

test('ancres d’intertitres : sans accents, uniques dans l’article', () => {
  const used = new Set<string>();
  assert.equal(headingAnchor('L’été à Tokyo !', used), 'lete-a-tokyo');
  assert.equal(headingAnchor('L’été à Tokyo !', used), 'lete-a-tokyo-2');
  assert.equal(headingAnchor('???', used), 'section');
});

test('un contenu illisible devient un document vide, sans planter la page', () => {
  assert.deepEqual(asBlogDoc(null), { type: 'doc', content: [] });
  assert.deepEqual(asBlogDoc('<p>html</p>'), { type: 'doc', content: [] });
  assert.deepEqual(asBlogDoc({ type: 'doc', content: 'x' }), { type: 'doc', content: [] });
  const doc = { type: 'doc', content: [{ type: 'paragraph' }] };
  assert.deepEqual(asBlogDoc(doc), doc);
});
