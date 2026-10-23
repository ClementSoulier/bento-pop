import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_LANDING_URL,
  episodeAccessibilityLabel,
  episodeActionLabel,
  episodeBadgeLabel,
  episodeDurationLabel,
  episodeLabelTitle,
  episodeOpenHint,
  episodesQueryOptions,
  isAllowedOpenUrl,
  loadEpisodes,
  normalizeLandingUrl,
  parseEpisode,
  parseEpisodes,
  timeOf,
} from './episodes';

const LANDING = 'https://bento-pop.com';
const NOW = Date.parse('2026-10-23T12:00:00.000Z');

const raw = (over: Record<string, unknown> = {}) => ({
  id: 'show-1',
  kind: 'show',
  slug: 'il-reprend-les-generiques',
  title: 'Il reprend les génériques avec les vraies voix FR',
  publishedAt: '2026-10-20T16:00:00.000Z',
  season: 2,
  episodeNumber: 5,
  durationSeconds: 2530,
  thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
  platform: 'youtube',
  openUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  ...over,
});

const podcastRaw = (over: Record<string, unknown> = {}) =>
  raw({
    id: 'podcast-1',
    kind: 'podcast',
    slug: 'du-mont-fuji-a-fukushima',
    title: 'Du mont Fuji à Fukushima',
    publishedAt: '2026-10-13T16:00:00.000Z',
    episodeNumber: 4,
    durationSeconds: 2280,
    thumbnailUrl: null,
    platform: 'spotify',
    openUrl: 'https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk',
    ...over,
  });

describe('normalizeLandingUrl', () => {
  it('garde l’origine de l’adresse compilée, recette locale comprise', () => {
    assert.equal(normalizeLandingUrl('https://bento-pop.com/'), 'https://bento-pop.com');
    assert.equal(normalizeLandingUrl('http://127.0.0.1:3211'), 'http://127.0.0.1:3211');
    assert.equal(
      normalizeLandingUrl('  http://192.168.1.20:3211/chemin  '),
      'http://192.168.1.20:3211',
    );
  });

  it('retombe sur bento-pop.com quand la variable manque ou ne se lit pas', () => {
    for (const value of [
      undefined,
      null,
      '',
      'bento-pop.com',
      'ftp://bento-pop.com',
      'javascript:alert(1)',
    ]) {
      assert.equal(normalizeLandingUrl(value), DEFAULT_LANDING_URL, String(value));
    }
  });
});

describe('isAllowedOpenUrl', () => {
  it('accepte les quatre plateformes, en https et sur leur hôte', () => {
    assert.ok(isAllowedOpenUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube', LANDING));
    assert.ok(
      isAllowedOpenUrl(
        'https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk',
        'spotify',
        LANDING,
      ),
    );
    assert.ok(isAllowedOpenUrl('https://www.deezer.com/episode/700000001', 'deezer', LANDING));
    assert.ok(
      isAllowedOpenUrl(
        'https://podcasts.apple.com/fr/podcast/id1234567890?i=1000650000001',
        'apple',
        LANDING,
      ),
    );
  });

  it('refuse une autre plateforme, un autre hôte, http, ou un faux hôte', () => {
    assert.equal(isAllowedOpenUrl('http://www.youtube.com/watch?v=x', 'youtube', LANDING), false);
    assert.equal(isAllowedOpenUrl('https://open.spotify.com/episode/x', 'youtube', LANDING), false);
    assert.equal(
      isAllowedOpenUrl('https://www.youtube.com.exemple.test/watch?v=x', 'youtube', LANDING),
      false,
    );
    assert.equal(
      isAllowedOpenUrl('https://exemple.test@www.youtube.com/watch?v=x', 'youtube', LANDING),
      false,
    );
    assert.equal(isAllowedOpenUrl('javascript:alert(1)', 'youtube', LANDING), false);
    assert.equal(
      isAllowedOpenUrl('intent://open.spotify.com/episode/x', 'spotify', LANDING),
      false,
    );
  });

  it('accepte la page d’épisode de la landing connue, http compris en recette (D13)', () => {
    assert.ok(isAllowedOpenUrl('https://bento-pop.com/podcasts/du-mont-fuji', 'site', LANDING));
    assert.ok(isAllowedOpenUrl('https://bento-pop.com/emissions/vivre-de-tiktok', 'site', LANDING));
    assert.ok(
      isAllowedOpenUrl(
        'http://127.0.0.1:3211/podcasts/ambiance-tokyo',
        'site',
        'http://127.0.0.1:3211',
      ),
    );
  });

  it('refuse sur le site une autre origine, ou une autre page qu’une page d’épisode', () => {
    assert.equal(isAllowedOpenUrl('https://exemple.test/podcasts/x', 'site', LANDING), false);
    assert.equal(isAllowedOpenUrl('http://bento-pop.com/podcasts/x', 'site', LANDING), false);
    assert.equal(isAllowedOpenUrl('https://bento-pop.com/u/keremasan', 'site', LANDING), false);
    assert.equal(isAllowedOpenUrl('https://bento-pop.com/podcasts/', 'site', LANDING), false);
    assert.equal(isAllowedOpenUrl('https://bento-pop.com/podcasts/a/b', 'site', LANDING), false);
  });
});

describe('timeOf', () => {
  it('lit les microsecondes de PostgREST comme les millisecondes de la landing', () => {
    assert.equal(
      timeOf('2026-10-20T16:00:00.123456+00:00'),
      Date.parse('2026-10-20T16:00:00.123Z'),
    );
    assert.equal(timeOf('2026-10-20T16:00:00.000Z'), Date.parse('2026-10-20T16:00:00.000Z'));
    assert.ok(Number.isNaN(timeOf('demain')));
  });
});

describe('parseEpisode', () => {
  it('garde un épisode complet, avec sa clé de liste et sa date en millisecondes', () => {
    assert.deepEqual(parseEpisode(raw(), LANDING), {
      key: 'episode:show:show-1',
      id: 'show-1',
      kind: 'show',
      slug: 'il-reprend-les-generiques',
      title: 'Il reprend les génériques avec les vraies voix FR',
      publishedAt: '2026-10-20T16:00:00.000Z',
      publishedAtMs: Date.parse('2026-10-20T16:00:00.000Z'),
      season: 2,
      episodeNumber: 5,
      durationSeconds: 2530,
      thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      platform: 'youtube',
      openUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    });
  });

  it('écarte un épisode dont un champ requis manque ou ne se lit pas', () => {
    for (const over of [
      { id: '' },
      { title: '   ' },
      { slug: null },
      { kind: 'clip' },
      { publishedAt: 'demain' },
      { season: '2' },
      { openUrl: 42 },
    ]) {
      assert.equal(parseEpisode(raw(over), LANDING), null, JSON.stringify(over));
    }
    assert.equal(parseEpisode(null, LANDING), null);
    assert.equal(parseEpisode('show-1', LANDING), null);
  });

  it('écarte une plateforme qui ne va pas avec le type, même à l’adresse valide', () => {
    // L'adresse est bonne pour la plateforme annoncée : seule la règle du type
    // peut écarter une émission sur Spotify, ou un podcast sur YouTube.
    const spotifyUrl = 'https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk';
    assert.equal(parseEpisode(raw({ platform: 'spotify', openUrl: spotifyUrl }), LANDING), null);
    const youtubeUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    assert.equal(
      parseEpisode(podcastRaw({ platform: 'youtube', openUrl: youtubeUrl }), LANDING),
      null,
    );
  });

  it('écarte une adresse refusée pour sa plateforme', () => {
    assert.equal(parseEpisode(raw({ openUrl: 'https://exemple.test/watch?v=x' }), LANDING), null);
  });

  it('garde un épisode dont la vignette n’est pas en https, sans vignette', () => {
    assert.equal(
      parseEpisode(raw({ thumbnailUrl: 'http://i.ytimg.com/vi/x/hq.jpg' }), LANDING)?.thumbnailUrl,
      null,
    );
    assert.equal(
      parseEpisode(raw({ thumbnailUrl: 'pas une adresse' }), LANDING)?.thumbnailUrl,
      null,
    );
  });

  it('lit un numéro d’épisode ou une durée absents comme rien', () => {
    const episode = parseEpisode(raw({ episodeNumber: null, durationSeconds: 0 }), LANDING);
    assert.equal(episode?.episodeNumber, null);
    assert.equal(episode?.durationSeconds, null);
  });
});

describe('parseEpisodes', () => {
  it('garde les épisodes valides, sans doublon, du plus récent au plus ancien', () => {
    const episodes = parseEpisodes(
      {
        episodes: [
          podcastRaw(),
          raw({ id: 'show-2', publishedAt: '2026-10-06T16:00:00.000Z' }),
          raw(),
          raw(),
          raw({ id: 'mauvais', openUrl: 'https://exemple.test/' }),
          podcastRaw({ id: 'podcast-meme-date', publishedAt: '2026-10-20T16:00:00.000Z' }),
        ],
      },
      LANDING,
    );
    assert.deepEqual(
      episodes.map((e) => e.key),
      [
        'episode:show:show-1',
        'episode:podcast:podcast-meme-date',
        'episode:podcast:podcast-1',
        'episode:show:show-2',
      ],
    );
  });

  it('rend une liste vide pour une réponse qui n’en est pas une', () => {
    for (const body of [null, 'texte', {}, { episodes: 'non' }, []]) {
      assert.deepEqual(parseEpisodes(body, LANDING), [], JSON.stringify(body));
    }
  });
});

/** Un `fetch` qui note ses appels et rend ce qu'on lui dit. */
function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
  return { fn, calls };
}

describe('loadEpisodes', () => {
  it('demande la route de la landing, en JSON, et rend les épisodes valides', async () => {
    const { fn, calls } = fakeFetch(200, { episodes: [raw(), podcastRaw()] });
    const episodes = await loadEpisodes(fn, 'http://127.0.0.1:3211', undefined);
    assert.equal(calls[0]?.url, 'http://127.0.0.1:3211/api/episodes');
    assert.equal((calls[0]?.init?.headers as Record<string, string>).Accept, 'application/json');
    assert.deepEqual(
      episodes.map((e) => e.id),
      ['show-1', 'podcast-1'],
    );
  });

  it('lève sur une panne de la landing : l’écran la lira comme « aucun épisode »', async () => {
    const { fn } = fakeFetch(503, { error: 'Épisodes indisponibles' });
    await assert.rejects(loadEpisodes(fn, LANDING), /503/);
  });

  it('abandonne après le délai, sans réessai', async () => {
    const never = (async (_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })) as typeof fetch;
    const options = episodesQueryOptions(never, LANDING, 20);
    assert.equal(options.retry, false);
    await assert.rejects(
      options.queryFn({ signal: new AbortController().signal }),
      /Abandon après 20 ms/,
    );
  });
});

describe('libellés', () => {
  const show = parseEpisode(raw(), LANDING)!;
  const podcast = parseEpisode(podcastRaw(), LANDING)!;

  it('dit le type, la saison, l’épisode, le titre, la durée et la date, accordés', () => {
    assert.equal(
      episodeAccessibilityLabel(show, NOW),
      'Émission Bento Pop, saison 2, épisode 5 : Il reprend les génériques avec les vraies voix FR. 42 minutes. Publiée il y a 2 jours.',
    );
    assert.equal(
      episodeAccessibilityLabel(podcast, NOW),
      'Podcast Bento Pop, saison 2, épisode 4 : Du mont Fuji à Fukushima. 38 minutes. Publié il y a 1 semaine.',
    );
  });

  it('se passe du numéro d’épisode et de la durée quand ils manquent', () => {
    const bare = parseEpisode(raw({ episodeNumber: null, durationSeconds: null }), LANDING)!;
    assert.equal(
      episodeAccessibilityLabel(bare, NOW),
      'Émission Bento Pop, saison 2 : Il reprend les génériques avec les vraies voix FR. Publiée il y a 2 jours.',
    );
  });

  it('dit les heures d’un long épisode', () => {
    const long = parseEpisode(raw({ durationSeconds: 3900 }), LANDING)!;
    assert.match(episodeAccessibilityLabel(long, NOW), / 1 heure 5 minutes\. /);
  });

  it('reprend la pastille et la durée de la carte du site', () => {
    assert.equal(episodeBadgeLabel(show), 'S2 · E5');
    assert.equal(episodeBadgeLabel({ season: 1, episodeNumber: null }), 'S1');
    assert.equal(episodeDurationLabel(2530), '42min');
    assert.equal(episodeDurationLabel(3900), '1h 05min');
    assert.equal(episodeDurationLabel(45), '45s');
    assert.equal(episodeDurationLabel(null), '');
  });

  it('dit où mène le tap', () => {
    assert.equal(episodeOpenHint('youtube'), 'S’ouvre dans YouTube.');
    assert.equal(episodeOpenHint('apple'), 'S’ouvre dans Apple Podcasts.');
    assert.equal(episodeOpenHint('site'), 'S’ouvre sur bento-pop.com.');
  });

  it('signe l’étiquette du type, comme le pseudo d’un bento', () => {
    assert.equal(episodeLabelTitle('show'), 'Bento Pop · Émission');
    assert.equal(episodeLabelTitle('podcast'), 'Bento Pop · Podcast');
  });

  it('écrit sur la carte ce que fait le tap, et où', () => {
    assert.equal(episodeActionLabel(show), 'Regarder sur YouTube');
    assert.equal(episodeActionLabel(podcast), 'Écouter sur Spotify');
    assert.equal(
      episodeActionLabel({ kind: 'podcast', platform: 'apple' }),
      'Écouter sur Apple Podcasts',
    );
    // D13 : un épisode que sa plateforme n'a pas repris s'ouvre sur le site.
    assert.equal(
      episodeActionLabel({ kind: 'podcast', platform: 'site' }),
      'Écouter sur bento-pop.com',
    );
    assert.equal(episodeActionLabel({ kind: 'show', platform: 'site' }), 'Voir sur bento-pop.com');
  });
});
