import assert from 'node:assert/strict';
import { test } from 'node:test';

import { pollPercentages, readPollAttrs } from './poll';

const ATTRS = {
  weekId: 'x',
  weekTag: 'S47',
  question: 'Le meilleur Zelda ?',
  options: [
    { label: 'Breath of the Wild', votes: 30 },
    { label: 'Ocarina of Time', votes: 12 },
  ],
  total: 42,
  closedAt: '2026-11-26T18:00:00.000Z',
};

test('un bloc valide est relu, total recalculé', () => {
  assert.deepEqual(readPollAttrs({ ...ATTRS, total: 9999 }), {
    question: 'Le meilleur Zelda ?',
    weekTag: 'S47',
    options: ATTRS.options,
    total: 42,
    closedAt: '2026-11-26T18:00:00.000Z',
  });
});

test('un bloc illisible n’est pas rendu', () => {
  for (const attrs of [
    undefined,
    { ...ATTRS, question: '' },
    { ...ATTRS, options: [{ label: 'Seule', votes: 1 }] },
    { ...ATTRS, options: [{ label: 'A', votes: -2 }, { label: 'B', votes: 1 }] },
    { ...ATTRS, options: [{ label: '', votes: 1 }, { label: 'B', votes: 1 }] },
    { ...ATTRS, options: 'pas un tableau' },
  ]) {
    assert.equal(readPollAttrs(attrs as Record<string, unknown> | undefined), null, JSON.stringify(attrs));
  }
});

test('date ou semaine absentes ne bloquent pas le rendu', () => {
  const poll = readPollAttrs({ ...ATTRS, weekTag: null, closedAt: 'n’importe quoi' });
  assert.equal(poll?.weekTag, null);
  assert.equal(poll?.closedAt, null);
});

test('pourcentages arrondis à 100, mêmes valeurs que l’admin', () => {
  assert.deepEqual(pollPercentages([30, 12]), [71, 29]);
  assert.deepEqual(pollPercentages([1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(pollPercentages([0, 0, 0]), [0, 0, 0]);
});
