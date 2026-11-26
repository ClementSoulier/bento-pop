import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CATEGORY_META, CATEGORY_ORDER } from '@bento-pop/supabase-mobile/bento';
import { searchPlaceholder } from './layout';

describe('searchPlaceholder', () => {
  /**
   * Repéré sur une capture de recette, pas par relecture : « Cherche un
   * chanson… » sur l'écran « Son », et « Cherche un série… » sur l'écran
   * « Série ». Deux écrans sur six.
   */
  it('accorde l\'article au genre du libellé', () => {
    for (const cle of CATEGORY_ORDER) {
      const attendu = `Cherche ${CATEGORY_META[cle].gender === 'f' ? 'une' : 'un'} ${CATEGORY_META[cle].label.toLowerCase()}…`;
      assert.equal(searchPlaceholder(CATEGORY_META[cle]), attendu, cle);
    }
    assert.equal(searchPlaceholder(CATEGORY_META.track), 'Cherche une chanson…');
    assert.equal(searchPlaceholder(CATEGORY_META.series), 'Cherche une série…');
    assert.equal(searchPlaceholder(CATEGORY_META.film), 'Cherche un film…');
  });

  it('couvre les six cases sans trou', () => {
    for (const cat of CATEGORY_ORDER) {
      const text = searchPlaceholder(CATEGORY_META[cat]);
      assert.match(text, /^Cherche une? .+…$/, `placeholder douteux pour ${cat} : ${text}`);
      assert.ok(!text.includes('undefined'), cat);
    }
  });

  /**
   * Une case d'édition n'est pas dans `CATEGORY_META` : son intitulé et son
   * genre viennent de la base. La fonction ne doit donc rien en savoir.
   */
  /**
   * Une case d'édition porte une question, pas un nom commun : « Cherche une
   * la série que tu caches… » ne veut rien dire. La question est déjà le
   * titre de la feuille, le champ n'a pas à la répéter.
   */
  it('ne met pas d\'article devant la question d\'une édition', () => {
    assert.equal(
      searchPlaceholder({ label: 'La série que tu caches', gender: 'f' }, false),
      'Cherche…',
    );
  });
});
