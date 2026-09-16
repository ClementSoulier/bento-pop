import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hasExactTitle, normalizeTitle } from './exact-title';

describe('normalizeTitle', () => {
  it('ignore la casse, les accents et la ponctuation', () => {
    assert.equal(normalizeTitle('Amélie Poulain'), 'amelie poulain');
    assert.equal(normalizeTitle('SQUEEZIE'), 'squeezie');
    assert.equal(normalizeTitle('  Spider-Man 2 !  '), 'spider man 2');
  });

  it('ignore ce que l’affichage ignore déjà', () => {
    // `cleanTitle` retire les parenthèses et les crochets.
    assert.equal(normalizeTitle('Inception (film)'), 'inception');
    assert.equal(normalizeTitle('Lumière (from Californication)'), 'lumiere');
  });
});

describe('hasExactTitle', () => {
  const results = ['Squeezie', 'Queen', 'Le Voyage de Chihiro'];

  it('reconnaît le titre déjà trouvé, quelle que soit la façon de l’écrire', () => {
    for (const query of ['Squeezie', 'squeezie', 'SQUEEZIE', '  Squeezie  ']) {
      assert.ok(hasExactTitle(query, results), query);
    }
    assert.ok(hasExactTitle('le voyage de chihiro', results));
  });

  it('laisse proposer un titre qui n’y est pas', () => {
    for (const query of ['Squeezie Fan', 'Squeez', 'Queens', 'Chihiro']) {
      assert.ok(!hasExactTitle(query, results), query);
    }
  });

  it('ne dit rien d’une recherche vide', () => {
    assert.ok(!hasExactTitle('', results));
    assert.ok(!hasExactTitle('   ', results));
    assert.ok(!hasExactTitle('(...)', results));
  });

  it('ne se trompe pas sur une liste vide', () => {
    assert.ok(!hasExactTitle('Squeezie', []));
  });
});
