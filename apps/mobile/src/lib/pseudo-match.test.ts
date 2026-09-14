import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pickExactPseudo } from './pseudo-match';

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
