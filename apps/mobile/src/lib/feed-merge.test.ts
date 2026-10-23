import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { FeedEpisode } from './episodes';
import type { FeedBento } from './feed';
import { interleaveFeed, type FeedItem } from './feed-merge';

/** Un bento réduit à ce que la fusion lit : son identifiant et sa date. */
const bento = (id: string, publishedAt: string): FeedBento =>
  ({ bentoId: id, publishedAt }) as unknown as FeedBento;

const episode = (
  id: string,
  publishedAt: string,
  kind: FeedEpisode['kind'] = 'show',
): FeedEpisode =>
  ({
    key: `episode:${kind}:${id}`,
    id,
    kind,
    publishedAt,
    publishedAtMs: Date.parse(publishedAt),
  }) as unknown as FeedEpisode;

const keys = (items: FeedItem[]) => items.map((item) => item.key);

// Trois bentos, du plus récent au plus ancien, aux dates de PostgREST.
const PAGE_1 = [
  bento('b1', '2026-10-21T09:00:00.123456+00:00'),
  bento('b2', '2026-10-10T09:00:00+00:00'),
];
const PAGE_2 = [bento('b3', '2026-09-20T09:00:00+00:00')];

const EPISODES = [
  episode('e-oct20', '2026-10-20T16:00:00.000Z'),
  episode('e-oct13', '2026-10-13T16:00:00.000Z', 'podcast'),
  episode('e-sep29', '2026-09-29T16:00:00.000Z', 'podcast'),
  episode('e-jan9', '2026-01-09T08:56:01.000Z'),
  episode('e-oct22', '2026-10-22T16:00:00.000Z'),
];

describe('interleaveFeed', () => {
  it('range chaque épisode à sa date parmi les bentos, plus récent en tête', () => {
    assert.deepEqual(keys(interleaveFeed([...PAGE_1, ...PAGE_2], EPISODES, true)), [
      'episode:show:e-oct22',
      'bento:b1',
      'episode:show:e-oct20',
      'episode:podcast:e-oct13',
      'bento:b2',
      'episode:podcast:e-sep29',
      'bento:b3',
      'episode:show:e-jan9',
    ]);
  });

  it('retient les épisodes plus anciens que le dernier bento chargé tant qu’une page reste à venir', () => {
    assert.deepEqual(keys(interleaveFeed(PAGE_1, EPISODES, false)), [
      'episode:show:e-oct22',
      'bento:b1',
      'episode:show:e-oct20',
      'episode:podcast:e-oct13',
      'bento:b2',
    ]);
  });

  it('ne fait rien bouger d’une page à la suivante : la première liste commence la seconde', () => {
    const first = keys(interleaveFeed(PAGE_1, EPISODES, false));
    const second = keys(interleaveFeed([...PAGE_1, ...PAGE_2], EPISODES, true));
    assert.deepEqual(second.slice(0, first.length), first);
  });

  it('met l’épisode avant le bento à date égale', () => {
    const same = '2026-10-20T16:00:00.000Z';
    assert.deepEqual(
      keys(interleaveFeed([bento('b', '2026-10-20T16:00:00+00:00')], [episode('e', same)], true)),
      ['episode:show:e', 'bento:b'],
    );
  });

  it('trie les épisodes elle-même, sans dépendre de l’ordre reçu', () => {
    const shuffled = [EPISODES[3]!, EPISODES[0]!, EPISODES[4]!, EPISODES[2]!, EPISODES[1]!];
    assert.deepEqual(
      keys(interleaveFeed([...PAGE_1, ...PAGE_2], shuffled, true)),
      keys(interleaveFeed([...PAGE_1, ...PAGE_2], EPISODES, true)),
    );
  });

  it('rend le fil des bentos tel quel sans épisode, et les épisodes seuls sans bento', () => {
    assert.deepEqual(keys(interleaveFeed(PAGE_1, [], false)), ['bento:b1', 'bento:b2']);
    assert.deepEqual(keys(interleaveFeed([], EPISODES, true)).length, 5);
    // Première page encore en route : rien plutôt que des épisodes seuls.
    assert.deepEqual(keys(interleaveFeed([], EPISODES, false)), []);
  });

  it('ne retient aucun épisode devant un bento à date illisible', () => {
    const items = interleaveFeed(
      [bento('illisible', 'pas une date'), bento('b2', '2026-10-10T09:00:00+00:00')],
      [episode('e-oct20', '2026-10-20T16:00:00.000Z')],
      true,
    );
    assert.deepEqual(keys(items), ['bento:illisible', 'episode:show:e-oct20', 'bento:b2']);
  });

  it('ne donne jamais deux fois la même clé', () => {
    const all = keys(interleaveFeed([...PAGE_1, ...PAGE_2], EPISODES, true));
    assert.equal(new Set(all).size, all.length);
  });
});
