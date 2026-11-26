import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  countWords,
  docPlainText,
  isSafeHref,
  readingMinutes,
  validateBlogDoc,
  youtubeIdFromUrl,
  type BlogDoc,
} from './document';

const para = (text: string, marks?: Array<{ type: string; attrs?: Record<string, unknown> }>) => ({
  type: 'paragraph',
  content: [{ type: 'text', text, ...(marks ? { marks } : {}) }],
});

test('un document complet et conforme passe', () => {
  const doc: BlogDoc = {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Intro' }] },
      para('Du texte en gras', [{ type: 'bold' }, { type: 'link', attrs: { href: 'https://bento-pop.com' } }]),
      { type: 'paragraph' },
      {
        type: 'bulletList',
        content: [{ type: 'listItem', content: [para('Un point')] }],
      },
      { type: 'blockquote', content: [para('Une citation')] },
      { type: 'horizontalRule' },
      { type: 'image', attrs: { src: 'https://supabase.bento-pop.com/x.webp', alt: 'Popy', width: 1600, height: 900 } },
      { type: 'youtube', attrs: { src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } },
    ],
  };
  assert.deepEqual(validateBlogDoc(doc), { ok: true, doc });
});

test('les éléments hors liste sont refusés avec un message lisible', () => {
  const cas: Array<[unknown, RegExp]> = [
    [null, /document attendu/],
    [{ type: 'paragraph' }, /document attendu/],
    [{ type: 'doc', content: [{ type: 'codeBlock' }] }, /codeBlock/],
    [{ type: 'doc', content: [{ type: 'heading', attrs: { level: 1 } }] }, /niveau 2 et 3/],
    [{ type: 'doc', content: [para('x', [{ type: 'code' }])] }, /code/],
    [{ type: 'doc', content: [para('x', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }])] }, /Lien refusé/],
    [{ type: 'doc', content: [{ type: 'image', attrs: { src: 'https://x.test/a.png', alt: '' } }] }, /texte alternatif/],
    [{ type: 'doc', content: [{ type: 'image', attrs: { src: 'data:image/png;base64,AAAA', alt: 'x' } }] }, /adresse valide/],
    [{ type: 'doc', content: [{ type: 'youtube', attrs: { src: 'https://vimeo.com/123' } }] }, /YouTube/],
    // Un texte directement dans le document, sans paragraphe : la landing ne saurait pas le placer.
    [{ type: 'doc', content: [{ type: 'text', text: 'x' }] }, /text/],
  ];
  for (const [doc, attendu] of cas) {
    const resultat = validateBlogDoc(doc);
    assert.equal(resultat.ok, false, JSON.stringify(doc));
    if (!resultat.ok) assert.match(resultat.error, attendu);
  }
});

test('un document trop imbriqué est refusé', () => {
  let node: Record<string, unknown> = para('fond');
  for (let i = 0; i < 15; i++) {
    node = { type: 'blockquote', content: [{ type: 'bulletList', content: [{ type: 'listItem', content: [node] }] }] };
  }
  const resultat = validateBlogDoc({ type: 'doc', content: [node] });
  assert.equal(resultat.ok, false);
});

test('liens : http(s), mailto, chemin du site et ancre seulement', () => {
  for (const ok of ['https://a.fr', 'http://a.fr/b', 'mailto:contact@bento-pop.com', '/emissions/x', '#chapitre']) {
    assert.equal(isSafeHref(ok), true, ok);
  }
  for (const ko of ['javascript:alert(1)', 'data:text/html,x', '//evil.test', '', 'ftp://a.fr', 42]) {
    assert.equal(isSafeHref(ko), false, String(ko));
  }
});

test('YouTube : les formes d’URL courantes donnent l’identifiant', () => {
  const id = 'dQw4w9WgXcQ';
  for (const url of [
    `https://www.youtube.com/watch?v=${id}&t=42s`,
    `https://youtu.be/${id}?si=abc`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube-nocookie.com/embed/${id}`,
    `https://m.youtube.com/watch?v=${id}`,
  ]) {
    assert.equal(youtubeIdFromUrl(url), id, url);
  }
  assert.equal(youtubeIdFromUrl('https://evil.test/watch?v=dQw4w9WgXcQ'), null);
  assert.equal(youtubeIdFromUrl('pas une url'), null);
});

test('texte brut, mots et temps de lecture', () => {
  const doc: BlogDoc = {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Le Japon' }] },
      { type: 'paragraph', content: [{ type: 'text', text: "C'est l'été" }, { type: 'hardBreak' }, { type: 'text', text: 'à Tokyo.' }] },
    ],
  };
  const texte = docPlainText(doc);
  assert.equal(texte, "Le Japon\nC'est l'été à Tokyo.");
  assert.equal(countWords(texte), 6);
  assert.equal(readingMinutes(0), 1);
  assert.equal(readingMinutes(230), 1);
  assert.equal(readingMinutes(231), 2);
});
