import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { markNoLongerHolds, shouldMarkForValidation, validationHint } from './publish-on-validation';

/**
 * Chantier 18 : quand l'app pose la marque « publié dès la validation », et
 * ce que dit la ligne sous la boîte.
 */

describe('shouldMarkForValidation', () => {
  const pret = {
    hasProfile: true,
    hydrated: true,
    pendingWrites: 0,
    published: false,
    marked: false,
    complete: true,
    hasPending: true,
  };

  it('un bento complet, en base, dont un item attend, sans marque : on marque', () => {
    assert.equal(shouldMarkForValidation(pret), true);
  });

  it('pas sans profil : le brouillon n’existe que sur le téléphone (D3)', () => {
    assert.equal(shouldMarkForValidation({ ...pret, hasProfile: false }), false);
  });

  it('pas avant la première lecture, ni pendant une écriture en vol', () => {
    // La marque se pose sur ce que la base sait : une case choisie à
    // l'instant n'y est peut-être pas encore.
    assert.equal(shouldMarkForValidation({ ...pret, hydrated: false }), false);
    assert.equal(shouldMarkForValidation({ ...pret, pendingWrites: 1 }), false);
  });

  it('pas un bento publié, déjà marqué, incomplet, ou où rien n’attend', () => {
    assert.equal(shouldMarkForValidation({ ...pret, published: true }), false);
    assert.equal(shouldMarkForValidation({ ...pret, marked: true }), false);
    assert.equal(shouldMarkForValidation({ ...pret, complete: false }), false);
    assert.equal(shouldMarkForValidation({ ...pret, hasPending: false }), false);
  });
});

describe('markNoLongerHolds', () => {
  const tient = { marked: true, published: false, complete: true, hasPending: true };

  it('une marque tient tant que le bento est complet, non publié, et qu’un item attend', () => {
    assert.equal(markNoLongerHolds(tient), false);
  });

  it('elle tombe comme en base : publié, incomplet, ou plus rien n’attend (D2)', () => {
    assert.equal(markNoLongerHolds({ ...tient, published: true }), true);
    assert.equal(markNoLongerHolds({ ...tient, complete: false }), true);
    assert.equal(markNoLongerHolds({ ...tient, hasPending: false }), true);
  });

  it('sans marque, rien à oublier', () => {
    assert.equal(markNoLongerHolds({ ...tient, marked: false, published: true }), false);
  });
});

describe('validationHint', () => {
  it('un item attend : il est nommé', () => {
    assert.equal(validationHint(['Interstellar']), 'à la validation de « Interstellar »');
  });

  it('plusieurs : on les compte, plutôt qu’une liste coupée', () => {
    assert.equal(validationHint(['Interstellar', 'Dune']), 'à la validation de tes 2 items');
  });

  it('un titre vide ne laisse pas de guillemets orphelins', () => {
    assert.equal(validationHint(['  ']), 'à la validation de ton item');
    assert.equal(validationHint([]), 'à la validation de ton item');
  });
});
