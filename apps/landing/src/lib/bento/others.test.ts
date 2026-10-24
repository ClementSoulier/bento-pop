import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compareOthers, creditLabel, otherBentoTitle } from './others';

/**
 * Les autres bentos d'un compte sur la page web, chantier 21 : le même ordre
 * et les mêmes titres que dans l'app.
 */

const row = (id: string, published_at: string, is_primary = false) => ({ id, published_at, is_primary });

describe('compareOthers', () => {
  it('range du plus récent au plus ancien, comme la liste de l’app', () => {
    const rows = [
      row('b-vieux', '2025-01-01T00:00:00+00:00'),
      row('b-recent', '2026-10-20T00:00:00+00:00'),
      row('b-milieu', '2026-02-01T00:00:00+00:00'),
    ];
    assert.deepEqual(
      [...rows].sort(compareOthers).map((r) => r.id),
      ['b-recent', 'b-milieu', 'b-vieux'],
    );
  });

  it('met le principal en tête, quelle que soit sa date', () => {
    const rows = [
      row('b-recent', '2026-10-20T00:00:00+00:00'),
      row('b-principal', '2025-01-01T00:00:00+00:00', true),
    ];
    assert.deepEqual(
      [...rows].sort(compareOthers).map((r) => r.id),
      ['b-principal', 'b-recent'],
    );
  });

  it('départage deux dates égales par l’identifiant, comme le fil', () => {
    const date = '2026-10-20T00:00:00+00:00';
    assert.deepEqual(
      [row('b-1', date), row('b-2', date)].sort(compareOthers).map((r) => r.id),
      ['b-2', 'b-1'],
    );
  });
});

describe('otherBentoTitle', () => {
  it('nomme l’édition, le principal, ou l’adresse d’un bento libre', () => {
    assert.equal(otherBentoTitle({ editionTitle: 'Le duel du samedi', isPrimary: false, slug: 'rec-2' }), 'Le duel du samedi');
    assert.equal(otherBentoTitle({ editionTitle: null, isPrimary: true, slug: 'mon-bento' }), 'Bento principal');
    assert.equal(otherBentoTitle({ editionTitle: null, isPrimary: false, slug: 'hebdo-38' }), 'hebdo-38');
  });
});

describe('creditLabel', () => {
  it('garde le nom de la catégorie pour une case du bento principal', () => {
    assert.equal(creditLabel({ key: 'film', stamp: 'FILM' }), 'Film');
    assert.equal(creditLabel({ key: 'creator', stamp: 'CRÉA' }), 'Créateur de contenu');
  });

  it('nomme une case d’édition par son tampon', () => {
    assert.equal(creditLabel({ key: 'rec2_1', stamp: 'SÉRIE' }), 'Série');
  });
});
