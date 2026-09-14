import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PSEUDO_REGEX, escapeLikePattern, pickExactPseudo } from './pseudo-match';

const rows = [
  { pseudo: 'buyt.k' },
  { pseudo: 'buytak' },
  { pseudo: 'Dark_Hifus' },
  { pseudo: 'darkahifus' },
  { pseudo: 'keremasan' },
];

describe('pickExactPseudo', () => {
  it('retient la correspondance exacte', () => {
    assert.deepEqual(pickExactPseudo(rows, 'keremasan'), { pseudo: 'keremasan' });
  });

  it('ignore la casse', () => {
    assert.deepEqual(pickExactPseudo(rows, 'dark_hifus'), { pseudo: 'Dark_Hifus' });
    assert.deepEqual(pickExactPseudo(rows, 'KEREMASAN'), { pseudo: 'keremasan' });
  });

  it('tolère les espaces autour', () => {
    assert.deepEqual(pickExactPseudo(rows, '  keremasan '), { pseudo: 'keremasan' });
  });

  /**
   * Le cœur du correctif. `ilike('pseudo', 'buyt_k')` remonte `buyt.k`
   * côté base, le `_` étant le joker « un caractère ». Sans ce filtre, un
   * lien profond `bentopop://u/buyt_k` affichait le bento de `buyt.k`.
   */
  it('rejette une correspondance obtenue par le joker underscore', () => {
    assert.equal(pickExactPseudo(rows, 'buyt_k'), null);
  });

  /**
   * Second effet du même joker : `Dark_Hifus` est libre pour son
   * propriétaire légitime, mais `ilike` remontait `darkahifus` et l'écran
   * d'inscription annonçait « pris ».
   */
  it('ne confond pas un pseudo à underscore avec un voisin', () => {
    assert.deepEqual(pickExactPseudo([{ pseudo: 'darkahifus' }], 'dark_hifus'), null);
  });

  it('renvoie null sur une liste vide', () => {
    assert.equal(pickExactPseudo([], 'keremasan'), null);
  });
});

describe('escapeLikePattern', () => {
  it('échappe le joker underscore, seul joker qu’un pseudo valide peut porter', () => {
    assert.equal(escapeLikePattern('dark_hifus'), 'dark\\_hifus');
    assert.equal(escapeLikePattern('bento_pop_culture'), 'bento\\_pop\\_culture');
  });

  it('laisse intact un pseudo sans joker', () => {
    assert.equal(escapeLikePattern('buyt.k'), 'buyt.k');
    assert.equal(escapeLikePattern('Keremasan'), 'Keremasan');
  });

  /**
   * L'antislash doit passer en premier : traité après, il doublerait ceux que
   * l'échappement de `%` et `_` vient d'ajouter.
   */
  it('échappe l’antislash avant les autres jokers', () => {
    assert.equal(escapeLikePattern('a\\_%'), 'a\\\\\\_\\%');
  });

  it('ne sert que derrière `PSEUDO_REGEX`, qui exclut `%`, `\\` et `*`', () => {
    for (const pseudo of ['dark%', 'dark\\', 'dark*']) {
      assert.equal(PSEUDO_REGEX.test(pseudo), false, pseudo);
    }
    assert.equal(PSEUDO_REGEX.test('dark_hifus'), true);
  });
});
