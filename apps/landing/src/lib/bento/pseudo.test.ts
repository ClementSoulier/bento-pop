import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canonicalPseudo, isValidPseudo, needsCanonicalRedirect } from './pseudo';

describe('isValidPseudo', () => {
  it('accepte les formes valides aux bornes de la contrainte SQL', () => {
    for (const value of [
      'abc', // longueur minimale
      'a'.repeat(20), // longueur maximale
      'keremasan',
      'Dark_Hifus',
      'buyt.k',
      'popy_2026',
      '123',
      'A.B_c9',
    ]) {
      assert.equal(isValidPseudo(value), true, `devrait accepter « ${value} »`);
    }
  });

  it('rejette les longueurs hors bornes', () => {
    assert.equal(isValidPseudo(''), false);
    assert.equal(isValidPseudo('ab'), false);
    assert.equal(isValidPseudo('a'.repeat(21)), false);
  });

  it('rejette les caractères hors du jeu autorisé', () => {
    for (const value of [
      'kerem asan', // espace
      'kerem-asan', // tiret
      'kéréma', // accent
      'kerem/asan',
      'kerem@san',
      'popy🍱',
      'kerem\nasan',
      'kerem\tasan',
    ]) {
      assert.equal(isValidPseudo(value), false, `devrait rejeter « ${value} »`);
    }
  });

  /**
   * Non-régression de sécurité. La recherche se fait en `.ilike()`, où `%`
   * est un joker PostgREST. Sans ce filtre, `/u/%25` (soit « % » une fois
   * décodé par Next) ferait matcher des lignes arbitraires.
   */
  it('rejette les jokers PostgREST et les tentatives de traversée', () => {
    for (const value of ['%', '%%', 'a%c', '%kerem%', '../../etc/passwd', '<script>']) {
      assert.equal(isValidPseudo(value), false, `devrait rejeter « ${value} »`);
    }
  });

  /**
   * `_` est en revanche autorisé par la contrainte SQL alors qu'il est un
   * joker `ilike` (un caractère). La validation seule ne suffit donc pas :
   * c'est la vérification d'égalité exacte dans `lookupPublicBento` qui
   * fait autorité. Ce test documente le partage des responsabilités.
   */
  it("accepte l'underscore, qui reste un joker géré côté requête", () => {
    assert.equal(isValidPseudo('a_c'), true);
  });

  it('rejette les valeurs non textuelles', () => {
    for (const value of [undefined, null, 42, ['abc'], {}, true]) {
      assert.equal(isValidPseudo(value), false);
    }
  });

  it("n'a pas d'état entre deux appels sur la même entrée", () => {
    // Un RegExp avec le drapeau `g` retiendrait `lastIndex` et alternerait
    // true/false. Garde-fou contre une régression sur le littéral.
    assert.equal(isValidPseudo('keremasan'), true);
    assert.equal(isValidPseudo('keremasan'), true);
    assert.equal(isValidPseudo('keremasan'), true);
  });
});

describe('canonicalPseudo', () => {
  it('normalise en minuscules', () => {
    assert.equal(canonicalPseudo('Keremasan'), 'keremasan');
    assert.equal(canonicalPseudo('BUYT.K'), 'buyt.k');
    assert.equal(canonicalPseudo('deja_bas'), 'deja_bas');
  });

  it('est idempotente', () => {
    assert.equal(canonicalPseudo(canonicalPseudo('MiXtE')), canonicalPseudo('MiXtE'));
  });
});

describe('needsCanonicalRedirect', () => {
  it('ne redirige pas une URL déjà canonique', () => {
    assert.equal(needsCanonicalRedirect('keremasan'), false);
    assert.equal(needsCanonicalRedirect('buyt.k'), false);
    assert.equal(needsCanonicalRedirect('a_b.9'), false);
  });

  it('redirige dès qu’une majuscule apparaît', () => {
    assert.equal(needsCanonicalRedirect('Keremasan'), true);
    assert.equal(needsCanonicalRedirect('KEREMASAN'), true);
    assert.equal(needsCanonicalRedirect('kEremasan'), true);
  });

  /**
   * L'enjeu n'est pas cosmétique. Sur une URL publique, chaque variante de
   * casse serait sinon une entrée de cache ISR et une requête Supabase
   * distinctes : un pseudo de vingt caractères en offre plus d'un million.
   * La décision étant purement lexicale, aucune de ces variantes ne touche
   * la base.
   */
  it('décide sans connaître la casse stockée', () => {
    assert.equal(needsCanonicalRedirect.length, 1, 'ne doit dépendre que de l’URL');
  });
});
