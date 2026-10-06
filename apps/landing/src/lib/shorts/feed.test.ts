import assert from 'node:assert/strict';
import { test } from 'node:test';

import { decodeEntities, guestFromTitle, parseShortsFeed } from './feed';

const entry = (id: string, title: string, published = '2026-10-01T16:00:02+00:00') => `
 <entry>
  <id>yt:video:${id}</id>
  <yt:videoId>${id}</yt:videoId>
  <title>${title}</title>
  <published>${published}</published>
  <media:group>
   <media:title>${title}</media:title>
   <media:thumbnail url="https://i2.ytimg.com/vi/${id}/hqdefault.jpg" width="480" height="360"/>
  </media:group>
 </entry>`;

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">
 <title>Mon Bento Pop</title>
 ${entry('dRZzVhuNl4k', 'Gero Japan fait son BentoPOP ! 🍱 #bento #pop')}
 ${entry('4r0FyL9PeVM', '@HappyCalie fait son BentoPOP ! 🍱 #bento #pop')}
 ${entry('Bx-dFhqiFcQ', 'Isoft fait son BentoPOP 🍱 ! #bento #pop')}
 ${entry('pas-un-id', 'Titre sans identifiant valide')}
</feed>`;

test('lit les shorts dans l’ordre du flux, sans le titre de la playlist', () => {
  const shorts = parseShortsFeed(FEED);
  assert.deepEqual(
    shorts.map((s) => s.youtubeId),
    ['dRZzVhuNl4k', '4r0FyL9PeVM', 'Bx-dFhqiFcQ'],
  );
  assert.equal(shorts[0]?.title, 'Gero Japan fait son BentoPOP ! 🍱 #bento #pop');
  assert.equal(shorts[0]?.publishedAt, '2026-10-01T16:00:02+00:00');
});

test('tire le nom de l’invité du titre', () => {
  assert.equal(guestFromTitle('Gero Japan fait son BentoPOP ! 🍱 #bento #pop'), 'Gero Japan');
  assert.equal(guestFromTitle('@HappyCalie fait son BentoPOP ! 🍱 #bento #pop'), 'HappyCalie');
  assert.equal(guestFromTitle('Isoft fait son BentoPOP 🍱 ! #bento #pop'), 'Isoft');
  assert.equal(guestFromTitle('Le Don fait son Bento Pop !'), 'Le Don');
});

test('garde un titre hors formule, sans ses hashtags', () => {
  assert.equal(guestFromTitle('Spécial Japan Expo 🍱 #bento #pop'), 'Spécial Japan Expo 🍱');
});

test('décode les entités du XML', () => {
  assert.equal(decodeEntities('Le &quot;fameux&quot; bonzaï &amp; l&#39;œuf &#x1F371;'), 'Le "fameux" bonzaï & l\'œuf 🍱');
  assert.equal(guestFromTitle(parseShortsFeed(FEED.replace('Gero Japan', 'Tom &amp; Jerry'))[0]!.title), 'Tom & Jerry');
});

test('rend une liste vide sur un flux vide ou invalide', () => {
  assert.deepEqual(parseShortsFeed(''), []);
  assert.deepEqual(parseShortsFeed('<html>Erreur</html>'), []);
});
