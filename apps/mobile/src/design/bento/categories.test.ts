import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CATEGORY_ORDER, MAIN_CASES } from '@bento-pop/supabase-mobile/bento';
import { icons } from '../icons';
import { colors } from '../tokens';
import { CATEGORY_STYLES, caseCategory } from './categories';

/** La catégorie d'une case (chantier 32, D5). */
describe('la catégorie d’une case', () => {
  it('vient de la clé pour les six cases du bento principal', () => {
    for (const meta of MAIN_CASES) assert.equal(caseCategory(meta), meta.key);
  });

  it('vient du type pour une case d’édition', () => {
    const edition = (typeKey: string, stamp = 'X') =>
      caseCategory({ key: 'ed1_1', typeKey, stamp });
    assert.equal(edition('film'), 'film');
    assert.equal(edition('series'), 'series');
    assert.equal(edition('song'), 'track');
    assert.equal(edition('place'), 'place');
  });

  it('donne Artiste au type « personne », Créateur si son tampon le dit', () => {
    assert.equal(caseCategory({ key: 'ed1_1', typeKey: 'person', stamp: 'ARTISTE' }), 'artist');
    assert.equal(caseCategory({ key: 'ed1_1', typeKey: 'person', stamp: 'DUEL' }), 'artist');
    assert.equal(caseCategory({ key: 'ed1_1', typeKey: 'person', stamp: ' créa ' }), 'creator');
  });

  it('le type passe avant le tampon, écrit librement au back-office', () => {
    assert.equal(caseCategory({ key: 'ed1_1', typeKey: 'film', stamp: 'LIEU' }), 'film');
  });

  it('prend le tampon quand le type n’est pas lu', () => {
    assert.equal(caseCategory({ key: 'ed1_1', stamp: 'SÉRIE' }), 'series');
    assert.equal(caseCategory({ key: 'ed1_1', typeKey: null, stamp: 'SON' }), 'track');
  });

  it('n’en donne aucune à un type sans couleur, pour le repli neutre', () => {
    for (const typeKey of ['video_game', 'book', 'dish', 'activity']) {
      assert.equal(caseCategory({ key: 'ed1_1', typeKey, stamp: 'JEU' }), null);
    }
    assert.equal(caseCategory({ key: 'ed1_1', stamp: 'DUEL' }), null);
  });
});

describe('le garde-manger', () => {
  it('donne une couleur, son encre et une icône existantes à chaque catégorie', () => {
    for (const key of CATEGORY_ORDER) {
      const { color, deep, icon } = CATEGORY_STYLES[key];
      assert.ok(colors.light[color], color);
      assert.ok(colors.light[deep], deep);
      assert.ok(icons[icon], icon);
    }
  });

  it('donne une couleur différente à chacune', () => {
    const tints = CATEGORY_ORDER.map((key) => CATEGORY_STYLES[key].color);
    assert.equal(new Set(tints).size, 6);
  });
});
