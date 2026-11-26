import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validateBlogDoc } from './document';
import {
  buildPollSnapshot,
  firstFreeSlug,
  pollPercentages,
  resultsDocument,
  resultsExcerpt,
  resultsSlugBase,
  resultsTitle,
  type PollSnapshot,
} from './poll';

const WEEK = {
  id: '7f0c2b1e-6a43-4c55-9d0e-2f6b8a1c3d4e',
  week_tag: 'S47',
  question: 'Le meilleur Zelda ?',
  options: [
    { id: 'a', label: 'Breath of the Wild' },
    { id: 'b', label: 'Ocarina of Time' },
    { id: 'c', label: 'Majora’s Mask' },
  ],
};

test('l’instantané suit l’ordre du sondage et ignore les options retirées', () => {
  const snap = buildPollSnapshot(
    WEEK,
    [
      { option_id: 'b', votes: 12 },
      { option_id: 'a', votes: 30 },
      { option_id: 'zz', votes: 99 },
    ],
    '2026-11-26T18:00:00.000Z',
  );
  assert.deepEqual(snap.options, [
    { label: 'Breath of the Wild', votes: 30 },
    { label: 'Ocarina of Time', votes: 12 },
    { label: 'Majora’s Mask', votes: 0 },
  ]);
  assert.equal(snap.total, 42);
  assert.equal(snap.closedAt, '2026-11-26T18:00:00.000Z');
});

test('les pourcentages font toujours 100', () => {
  assert.deepEqual(pollPercentages([1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(pollPercentages([2, 1]), [67, 33]);
  assert.deepEqual(pollPercentages([0, 0]), [0, 0]);
  for (const votes of [[7, 3, 5, 9], [1, 0, 0], [123, 456, 789, 1011, 12]]) {
    assert.equal(pollPercentages(votes).reduce((a, b) => a + b, 0), 100, votes.join(','));
  }
});

test('chapô : gagnant, égalité, singulier', () => {
  const base: PollSnapshot = {
    weekId: WEEK.id,
    weekTag: 'S47',
    question: 'Q',
    options: [
      { label: 'A', votes: 3 },
      { label: 'B', votes: 1 },
    ],
    total: 4,
    closedAt: '2026-11-26T18:00:00.000Z',
  };
  assert.equal(resultsExcerpt(base), 'Vous avez été 4 personnes à répondre. « A » l’emporte avec 75 % des votes.');
  assert.equal(
    resultsExcerpt({ ...base, options: [{ label: 'A', votes: 1 }, { label: 'B', votes: 1 }, { label: 'C', votes: 0 }], total: 2 }),
    'Vous avez été 2 personnes à répondre. Égalité en tête entre « A » et « B », à 50 % chacun.',
  );
  assert.match(
    resultsExcerpt({ ...base, options: [{ label: 'A', votes: 1 }, { label: 'B', votes: 0 }], total: 1 }),
    /^Vous avez été 1 personne à répondre\./,
  );
});

test('titre, slug et slug libre', () => {
  const snap = buildPollSnapshot(WEEK, [{ option_id: 'a', votes: 1 }], '2026-11-26T18:00:00.000Z');
  assert.equal(resultsTitle(snap), 'Résultats du Thermomètre : Le meilleur Zelda ?');
  assert.equal(resultsSlugBase(snap), 'thermometre-le-meilleur-zelda');
  assert.equal(firstFreeSlug('x', []), 'x');
  assert.equal(firstFreeSlug('x', ['x', 'x-2']), 'x-3');
});

test('le document généré passe la validation du blog', () => {
  const snap = buildPollSnapshot(WEEK, [{ option_id: 'a', votes: 5 }, { option_id: 'c', votes: 2 }], '2026-11-26T18:00:00.000Z');
  const result = validateBlogDoc(resultsDocument(snap));
  assert.equal(result.ok, true, result.ok ? '' : result.error);
});

test('un bloc sondage trafiqué est refusé', () => {
  const good = resultsDocument(buildPollSnapshot(WEEK, [{ option_id: 'a', votes: 5 }], '2026-11-26T18:00:00.000Z'));
  const poll = good.content?.[1];
  assert.ok(poll && poll.type === 'poll');
  const variants: Array<Record<string, unknown>> = [
    { ...poll.attrs, total: 999 },
    { ...poll.attrs, options: [{ label: 'Seule', votes: 1 }], total: 1 },
    { ...poll.attrs, options: [{ label: 'A', votes: -1 }, { label: 'B', votes: 1 }], total: 0 },
    { ...poll.attrs, options: [{ label: 'A', votes: 1.5 }, { label: 'B', votes: 1 }], total: 2.5 },
    { ...poll.attrs, question: '' },
    { ...poll.attrs, closedAt: 'pas une date' },
  ];
  for (const attrs of variants) {
    const doc = { type: 'doc', content: [{ type: 'poll', attrs }] };
    assert.equal(validateBlogDoc(doc).ok, false, JSON.stringify(attrs));
  }
});
