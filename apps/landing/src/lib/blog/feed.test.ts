import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildBlogFeed, escapeXml } from './feed';

test('échappement XML, caractères de contrôle retirés', () => {
  assert.equal(escapeXml(`Tom & Jerry <3 "l'été"`), 'Tom &amp; Jerry &lt;3 &quot;l&apos;été&quot;');
  assert.equal(escapeXml('a\u0000b\u0007c'), 'abc');
});

test('le flux liste les articles avec lien, guid, date, catégorie et auteurs', () => {
  const xml = buildBlogFeed('https://bento-pop.com/', [
    {
      slug: 'zelda-et-moi',
      title: 'Zelda & moi',
      excerpt: 'Un chapô <court>.',
      publishedAt: '2026-11-20T10:00:00Z',
      updatedAt: '2026-11-21T10:00:00Z',
      category: 'Jeux vidéo',
      authors: ['Florian Vernon', 'Clément Soulier'],
    },
  ]);
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<atom:link href="https:\/\/bento-pop.com\/blog\/feed.xml" rel="self"/);
  assert.match(xml, /<title>Zelda &amp; moi<\/title>/);
  assert.match(xml, /<link>https:\/\/bento-pop.com\/blog\/zelda-et-moi<\/link>/);
  assert.match(xml, /<guid isPermaLink="true">https:\/\/bento-pop.com\/blog\/zelda-et-moi<\/guid>/);
  assert.match(xml, /<pubDate>Fri, 20 Nov 2026 10:00:00 GMT<\/pubDate>/);
  assert.match(xml, /<lastBuildDate>Fri, 20 Nov 2026 10:00:00 GMT<\/lastBuildDate>/);
  assert.match(xml, /<description>Un chapô &lt;court&gt;.<\/description>/);
  assert.match(xml, /<category>Jeux vidéo<\/category>/);
  assert.match(xml, /<dc:creator>Florian Vernon, Clément Soulier<\/dc:creator>/);
});

test('un flux sans article reste un flux valide', () => {
  const xml = buildBlogFeed('https://bento-pop.com', [], Date.parse('2026-11-26T00:00:00Z'));
  assert.doesNotMatch(xml, /<item>/);
  assert.match(xml, /<lastBuildDate>Thu, 26 Nov 2026 00:00:00 GMT<\/lastBuildDate>/);
  assert.match(xml, /<\/channel>\n<\/rss>\n$/);
});
