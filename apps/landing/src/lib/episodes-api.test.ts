import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  podcastToApiEpisode,
  showToApiEpisode,
  toApiEpisodes,
  type PodcastEpisodeRow,
  type ShowEpisodeRow,
} from './episodes-api';

const NOW = Date.parse('2026-10-23T12:00:00.000Z');
const SITE = 'https://bento-pop.com';

const show = (over: Partial<ShowEpisodeRow> = {}): ShowEpisodeRow => ({
  id: 'show-1',
  slug: 'il-reprend-les-generiques',
  title: 'Il reprend les génériques avec les vraies voix FR',
  youtube_id: 'dQw4w9WgXcQ',
  thumbnail_url: null,
  duration_seconds: 2530,
  published_at: '2026-10-20T16:00:00+00:00',
  season: 2,
  episode_number: 5,
  ...over,
});

const podcast = (over: Partial<PodcastEpisodeRow> = {}): PodcastEpisodeRow => ({
  id: 'podcast-1',
  slug: 'du-mont-fuji-a-fukushima',
  title: 'Du mont Fuji à Fukushima',
  spotify_episode_id: '4rOoJ6Egrf8K2IrywzwOMk',
  audio_platform: 'spotify',
  audio_show_id: null,
  thumbnail_url: null,
  duration_seconds: 2280,
  published_at: '2026-10-13T16:00:00+00:00',
  season: 2,
  episode_number: 4,
  ...over,
});

describe('showToApiEpisode', () => {
  it('rend la carte d’une émission, la vidéo YouTube pour adresse', () => {
    assert.deepEqual(showToApiEpisode(show(), NOW, SITE), {
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
    });
  });

  it('garde la vignette du back-office si elle est en https, et seulement alors', () => {
    const custom = 'https://supabase.bento-pop.com/storage/v1/object/public/episodes/miniature.jpg';
    assert.equal(
      showToApiEpisode(show({ thumbnail_url: custom }), NOW, SITE)?.thumbnailUrl,
      custom,
    );
    assert.equal(
      showToApiEpisode(show({ thumbnail_url: 'http://exemple.test/miniature.jpg' }), NOW, SITE)
        ?.thumbnailUrl,
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    );
  });

  it('écarte une émission sans date, à date illisible, ou programmée', () => {
    assert.equal(showToApiEpisode(show({ published_at: null }), NOW, SITE), null);
    assert.equal(showToApiEpisode(show({ published_at: 'demain' }), NOW, SITE), null);
    assert.equal(
      showToApiEpisode(show({ published_at: '2026-10-27T16:00:00+00:00' }), NOW, SITE),
      null,
    );
  });

  it('garde une émission sortie à l’instant même', () => {
    const atNow = new Date(NOW).toISOString();
    assert.equal(showToApiEpisode(show({ published_at: atNow }), NOW, SITE)?.publishedAt, atNow);
  });

  it('ouvre la page du site quand la vidéo n’est pas connue, sans vignette YouTube', () => {
    for (const youtube_id of [
      null,
      '  ',
      'A_REMPLACER',
      'TODO_video',
      'abc&list=XYZ',
      'trop-court',
    ]) {
      const episode = showToApiEpisode(show({ youtube_id }), NOW, SITE);
      assert.equal(episode?.platform, 'site', String(youtube_id));
      assert.equal(episode?.openUrl, 'https://bento-pop.com/emissions/il-reprend-les-generiques');
      assert.equal(episode?.thumbnailUrl, null, String(youtube_id));
    }
  });

  it('n’affiche aucune durée nulle, négative ou illisible', () => {
    assert.equal(showToApiEpisode(show({ duration_seconds: 0 }), NOW, SITE)?.durationSeconds, null);
    assert.equal(
      showToApiEpisode(show({ duration_seconds: -5 }), NOW, SITE)?.durationSeconds,
      null,
    );
    assert.equal(
      showToApiEpisode(show({ duration_seconds: null }), NOW, SITE)?.durationSeconds,
      null,
    );
  });
});

describe('podcastToApiEpisode', () => {
  it('ouvre la page de l’épisode sur sa plateforme', () => {
    assert.equal(
      podcastToApiEpisode(podcast(), NOW, SITE)?.openUrl,
      'https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk',
    );
    assert.equal(
      podcastToApiEpisode(
        podcast({ audio_platform: 'deezer', spotify_episode_id: '700000001' }),
        NOW,
        SITE,
      )?.openUrl,
      'https://www.deezer.com/episode/700000001',
    );
    assert.equal(
      podcastToApiEpisode(
        podcast({
          audio_platform: 'apple',
          audio_show_id: '1234567890',
          spotify_episode_id: '1000650000001',
        }),
        NOW,
        SITE,
      )?.openUrl,
      'https://podcasts.apple.com/fr/podcast/id1234567890?i=1000650000001',
    );
  });

  it('ouvre la page du site tant que la plateforme n’a pas repris l’épisode', () => {
    // Le cas de 3 podcasts sur 20 au 23 octobre 2026, dont le plus récent.
    for (const spotify_episode_id of ['A_REMPLACER', 'TODO_spotify', '', null]) {
      const episode = podcastToApiEpisode(podcast({ spotify_episode_id }), NOW, SITE);
      assert.equal(episode?.platform, 'site', String(spotify_episode_id));
      assert.equal(episode?.openUrl, 'https://bento-pop.com/podcasts/du-mont-fuji-a-fukushima');
    }
  });

  it('ouvre la page du site pour un épisode Apple Podcasts sans son émission', () => {
    for (const audio_show_id of ['', null, 'pas-un-nombre']) {
      const episode = podcastToApiEpisode(
        podcast({ audio_platform: 'apple', spotify_episode_id: '1000650000001', audio_show_id }),
        NOW,
        SITE,
      );
      assert.equal(episode?.platform, 'site', String(audio_show_id));
    }
  });

  it('prend Spotify pour une plateforme inconnue, comme la page du podcast', () => {
    assert.equal(
      podcastToApiEpisode(podcast({ audio_platform: 'soundcloud' }), NOW, SITE)?.platform,
      'spotify',
    );
  });

  it('écarte un podcast sans date ou programmé', () => {
    assert.equal(podcastToApiEpisode(podcast({ published_at: null }), NOW, SITE), null);
    assert.equal(
      podcastToApiEpisode(podcast({ published_at: '2099-01-01T00:00:00Z' }), NOW, SITE),
      null,
    );
  });

  it('laisse la vignette vide quand le back-office n’en a pas : la carte prend un fond plein', () => {
    assert.equal(podcastToApiEpisode(podcast(), NOW, SITE)?.thumbnailUrl, null);
  });
});

describe('toApiEpisodes', () => {
  it('mêle émissions et podcasts du plus récent au plus ancien, sans les écartés', () => {
    const episodes = toApiEpisodes(
      {
        shows: [
          show(),
          show({ id: 'show-2', published_at: '2026-10-06T16:00:00+00:00' }),
          show({ id: 'show-futur', published_at: '2099-01-01T16:00:00+00:00' }),
          show({ id: 'show-sans-date', published_at: null }),
        ],
        podcasts: [
          podcast(),
          podcast({ id: 'podcast-2', published_at: '2026-09-29T16:00:00+00:00' }),
        ],
      },
      NOW,
      SITE,
    );
    assert.deepEqual(
      episodes.map((e) => e.id),
      ['show-1', 'podcast-1', 'show-2', 'podcast-2'],
    );
  });

  it('range à date égale l’émission avant le podcast, puis par identifiant', () => {
    const same = '2026-10-20T16:00:00+00:00';
    const episodes = toApiEpisodes(
      {
        shows: [
          show({ id: 'show-b', published_at: same }),
          show({ id: 'show-a', published_at: same }),
        ],
        podcasts: [podcast({ id: 'podcast-a', published_at: same })],
      },
      NOW,
      SITE,
    );
    assert.deepEqual(
      episodes.map((e) => e.id),
      ['show-a', 'show-b', 'podcast-a'],
    );
  });

  it('ne rend que les champs de la carte', () => {
    const [episode] = toApiEpisodes({ shows: [show()], podcasts: [] }, NOW, SITE);
    assert.deepEqual(Object.keys(episode ?? {}).sort(), [
      'durationSeconds',
      'episodeNumber',
      'id',
      'kind',
      'openUrl',
      'platform',
      'publishedAt',
      'season',
      'slug',
      'thumbnailUrl',
      'title',
    ]);
  });
});
