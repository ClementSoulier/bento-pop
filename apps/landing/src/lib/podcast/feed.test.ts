import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildFeed,
  escapeXml,
  formatDuration,
  publishableEpisodes,
  rfc2822,
  type FeedEpisode,
  type FeedSettings,
} from './feed';

const SETTINGS: FeedSettings = {
  title: 'Bento Pop!',
  description: 'Un podcast « pop culture » & compagnie',
  author: 'Liventure SAS & Dark Hifus Production',
  owner_name: 'Bento Pop',
  owner_email: 'contact@liventure.fr',
  language: 'fr',
  category: 'Leisure',
  subcategory: 'Hobbies',
  image_url: 'https://bento-pop.com/pochette.png',
  podcast_guid: '30fe2be0-e374-5d5e-af3e-23f7a473741b',
  copyright: 'Liventure',
  explicit: false,
  podcast_type: 'episodic',
  link: 'https://bento-pop.com',
  locked: true,
};

function episode(o: Partial<FeedEpisode> = {}): FeedEpisode {
  return {
    slug: 'un-episode',
    title: 'Un épisode',
    description: 'Une description',
    kind: 'podcast',
    audio_url: 'https://exemple.test/un-episode.mp3',
    audio_bytes: 1234,
    audio_mime: 'audio/mpeg',
    audio_published_at: '2026-09-15T16:00:00.000Z',
    duration_seconds: 1389,
    feed_guid: 'e810c911-ce05-4de0-8439-49b65eb391bd',
    feed_season: 2,
    feed_number: 2,
    explicit: false,
    episode_type: 'full',
    thumbnail_url: null,
    ...o,
  };
}

const MAINTENANT = new Date('2026-09-24T12:00:00.000Z');

test('échappe les caractères interdits en XML', () => {
  assert.equal(escapeXml('Arley & « toxique » <br>'), 'Arley &amp; « toxique » &lt;br&gt;');
  assert.equal(escapeXml("l'apostrophe"), 'l&apos;apostrophe');
});

test('retire les caractères de contrôle, qu’aucune entité ne peut représenter', () => {
  assert.equal(escapeXml('avant\u0001après'), 'avantaprès');
});

test('formate les durées en HH:MM:SS', () => {
  assert.equal(formatDuration(0), '00:00:00');
  assert.equal(formatDuration(1389), '00:23:09');
  assert.equal(formatDuration(4561), '01:16:01');
});

test('écrit les dates au format RFC 2822', () => {
  assert.equal(rfc2822('2026-09-15T16:00:00.000Z'), 'Tue, 15 Sep 2026 16:00:00 +0000');
});

test('refuse une date illisible plutôt que de produire un flux cassé', () => {
  assert.throws(() => rfc2822('pas une date'), /Date illisible/);
});

test('écarte un épisode dont la sortie audio est à venir', () => {
  const futur = episode({ audio_published_at: '2026-09-29T16:00:00.000Z' });
  assert.equal(publishableEpisodes([futur], MAINTENANT).length, 0);
});

test('écarte un épisode sans fichier, sans taille ou sans identifiant', () => {
  const cas = [episode({ audio_url: '' }), episode({ audio_bytes: 0 }), episode({ feed_guid: '' })];
  for (const e of cas) assert.equal(publishableEpisodes([e], MAINTENANT).length, 0);
});

test('trie du plus récent au plus ancien', () => {
  const vieux = episode({ feed_guid: 'a', audio_published_at: '2026-01-09T08:56:00.000Z' });
  const recent = episode({ feed_guid: 'b', audio_published_at: '2026-09-15T16:00:00.000Z' });
  const ordre = publishableEpisodes([vieux, recent], MAINTENANT).map((e) => e.feed_guid);
  assert.deepEqual(ordre, ['b', 'a']);
});

test('le flux porte les balises que les plateformes exigent', () => {
  const xml = buildFeed(SETTINGS, [episode()], 'https://bento-pop.com/feed.xml', MAINTENANT);
  for (const attendu of [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<podcast:guid>30fe2be0-e374-5d5e-af3e-23f7a473741b</podcast:guid>',
    '<podcast:locked owner="contact@liventure.fr">yes</podcast:locked>',
    '<itunes:email>contact@liventure.fr</itunes:email>',
    '<atom:link href="https://bento-pop.com/feed.xml" rel="self" type="application/rss+xml" />',
    '<itunes:category text="Leisure">',
    '<itunes:category text="Hobbies" />',
    '<guid isPermaLink="false">e810c911-ce05-4de0-8439-49b65eb391bd</guid>',
    '<enclosure url="https://exemple.test/un-episode.mp3" length="1234" type="audio/mpeg" />',
    '<itunes:duration>00:23:09</itunes:duration>',
    '<pubDate>Tue, 15 Sep 2026 16:00:00 +0000</pubDate>',
  ]) {
    assert.ok(xml.includes(attendu), `balise manquante : ${attendu}`);
  }
});

test('la page liée dépend de la rubrique', () => {
  const xml = buildFeed(
    SETTINGS,
    [episode({ kind: 'emission', slug: 'noob' })],
    'https://bento-pop.com/feed.xml',
    MAINTENANT,
  );
  assert.ok(xml.includes('<link>https://bento-pop.com/emissions/noob</link>'));
});

test('un flux sans épisode reste un XML valide', () => {
  const xml = buildFeed(SETTINGS, [], 'https://bento-pop.com/feed.xml', MAINTENANT);
  assert.ok(xml.includes('</channel>') && xml.includes('</rss>'));
  assert.ok(!xml.includes('<item>'));
});

test('une description contenant « ]]> » ne casse pas la section CDATA', () => {
  const xml = buildFeed(
    SETTINGS,
    [episode({ description: 'un piège ]]> au milieu' })],
    'https://bento-pop.com/feed.xml',
    MAINTENANT,
  );
  assert.ok(xml.includes(']]]]><![CDATA[>'));
  // La section doit se fermer autant de fois qu'elle s'ouvre.
  assert.equal((xml.match(/<!\[CDATA\[/g) ?? []).length, (xml.match(/\]\]>/g) ?? []).length);
});

test('les balises facultatives disparaissent quand la donnée manque', () => {
  const xml = buildFeed(
    SETTINGS,
    [episode({ duration_seconds: null, feed_season: null, feed_number: null })],
    'https://bento-pop.com/feed.xml',
    MAINTENANT,
  );
  assert.ok(!xml.includes('<itunes:duration>'));
  assert.ok(!xml.includes('<itunes:season>'));
  assert.ok(!xml.includes('<itunes:episode>'));
});
