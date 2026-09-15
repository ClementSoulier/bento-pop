import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isStarterItem,
  planStarterImport,
  starterExternalId,
  type ExistingItem,
} from './starter-import';

const existing = (title: string, externalId: string | null = null): ExistingItem => ({
  title,
  externalId,
});

describe('starterExternalId', () => {
  it('tire un identifiant du type et du titre, sans accents ni ponctuation', () => {
    assert.equal(starterExternalId('book', "L'Étranger"), 'starter:book:l-etranger');
    assert.equal(
      starterExternalId('video_game', 'Légendes Pokémon : Z-A'),
      'starter:video_game:legendes-pokemon-z-a',
    );
  });

  it('se reconnaît, et lui seul', () => {
    assert.equal(isStarterItem(starterExternalId('dish', 'Ramen')), true);
    assert.equal(isStarterItem('tmdb:27205'), false);
    assert.equal(isStarterItem(null), false);
  });
});

describe('planStarterImport', () => {
  const list = [
    { title: 'Le Petit Prince', subtitle: 'Antoine de Saint-Exupéry' },
    { title: 'Dune', subtitle: 'Frank Herbert' },
    { title: 'Sapiens', subtitle: 'Yuval Noah Harari' },
  ];

  it('importe tout dans un type vide', () => {
    const plan = planStarterImport('book', list, []);
    assert.equal(plan.toInsert.length, 3);
    assert.equal(plan.alreadyThere.length, 0);
  });

  it('écarte un titre déjà saisi, sans égard à la casse ni aux accents', () => {
    const plan = planStarterImport('book', list, [existing('LE PETIT PRINCE')]);
    assert.deepEqual(
      plan.toInsert.map((c) => c.title),
      ['Dune', 'Sapiens'],
    );
    assert.deepEqual(
      plan.alreadyThere.map((c) => c.title),
      ['Le Petit Prince'],
    );
  });

  it('écarte un titre connu comme alias', () => {
    const plan = planStarterImport('book', list, [existing('Sapiens : une brève histoire')], ['sapiens']);
    assert.deepEqual(
      plan.alreadyThere.map((c) => c.title),
      ['Sapiens'],
    );
  });

  /** L'équipe a corrigé le titre d'un brouillon importé : il ne revient pas. */
  it('reconnaît un brouillon importé puis renommé à son identifiant', () => {
    const renamed = existing('Dune, le cycle', starterExternalId('book', 'Dune'));
    const plan = planStarterImport('book', list, [renamed]);
    assert.deepEqual(
      plan.alreadyThere.map((c) => c.title),
      ['Dune'],
    );
  });

  it('ignore un identifiant qui ne vient pas d’une liste de départ', () => {
    assert.equal(planStarterImport('book', list, [existing('Autre chose', 'book:dune')]).toInsert.length, 3);
  });

  it('ne compte qu’une fois un doublon de la liste', () => {
    const plan = planStarterImport('book', [...list, { title: 'dune' }], []);
    assert.equal(plan.toInsert.length, 3);
  });
});
