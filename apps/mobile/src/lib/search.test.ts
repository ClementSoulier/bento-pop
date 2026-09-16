import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MIN_QUERY_LENGTH,
  isEmpty,
  isSearchable,
  mapSearchRow,
  matchAccessibilityLabel,
  sharedItemAccessibilityLabel,
  sharedItemQuery,
  splitResults,
  type SearchMatch,
  type SearchRow,
} from './search';

/**
 * Tests de la partie pure de `search.ts` : découpage en sections, filtre des
 * bloqués, libellés VoiceOver.
 *
 * L'appel réseau est exercé séparément dans `search.integration.test.ts`, et
 * les propriétés qui ne s'observent que sur la vraie base (absence de
 * cul-de-sac, échappement des jokers, latence) par
 * `apps/mobile/scripts/check-search-bentos.mjs`.
 */

const pseudoRow = (pseudo: string, over: Partial<SearchRow> = {}): SearchRow => ({
  slug: 'mon-bento',
    is_primary: true,
    bento_id: `bento-${pseudo}`,
  pseudo,
  display_name: null,
  is_featured: false,
  match_kind: 'pseudo',
  item_id: null,
  item_title: null,
  category_id: null,
  score: 2,
  ...over,
});

const itemRow = (pseudo: string, title: string, categoryId = 1, over: Partial<SearchRow> = {}): SearchRow => ({
  slug: 'mon-bento',
    is_primary: true,
    bento_id: `bento-${pseudo}`,
  pseudo,
  display_name: null,
  is_featured: false,
  match_kind: 'item',
  item_id: `item-${title}`,
  item_title: title,
  category_id: categoryId,
  score: 1,
  ...over,
});

describe('isSearchable', () => {
  it('refuse en dessous du plancher', () => {
    assert.equal(MIN_QUERY_LENGTH, 2);
    assert.equal(isSearchable(''), false);
    assert.equal(isSearchable('a'), false);
  });

  it('accepte à partir du plancher', () => {
    assert.equal(isSearchable('an'), true);
    assert.equal(isSearchable('inception'), true);
  });

  /**
   * Les espaces ne comptent pas : « a  » a la longueur 3 mais ne cherche
   * qu'une lettre, et déclencherait la requête que le plancher existe
   * précisément pour éviter.
   */
  it('ne compte pas les espaces', () => {
    assert.equal(isSearchable('  a  '), false);
    assert.equal(isSearchable('  an  '), true);
  });
});

describe('splitResults, découpage', () => {
  it('range une correspondance de pseudo dans les comptes', () => {
    const { accounts, viaItems } = splitResults([pseudoRow('dark_hifus')], new Set());
    assert.equal(accounts.length, 1);
    assert.equal(viaItems.length, 0);
    assert.equal(accounts[0]?.pseudo, 'dark_hifus');
    assert.equal(accounts[0]?.item, null);
  });

  it('range une correspondance d\'item dans la seconde section, avec sa raison', () => {
    const { accounts, viaItems } = splitResults([itemRow('ralgan', 'Inception', 1)], new Set());
    assert.equal(accounts.length, 0);
    assert.equal(viaItems.length, 1);
    assert.deepEqual(viaItems[0]?.item, {
      id: 'item-Inception',
      title: 'Inception',
      category: 'film',
    });
  });

  it('sépare les deux sections d\'une même réponse', () => {
    const { accounts, viaItems } = splitResults(
      [pseudoRow('joycaddict'), itemRow('axl56', 'Joyca', 5), itemRow('chiquito', 'Joyca', 5)],
      new Set(),
    );
    assert.deepEqual(accounts.map((a) => a.pseudo), ['joycaddict']);
    assert.deepEqual(viaItems.map((v) => v.pseudo), ['axl56', 'chiquito']);
  });

  /**
   * Le SQL classe par pertinence, avec des critères que le client ne
   * connaît pas. Retrier ici casserait un ordre stable et testable.
   */
  it('préserve l\'ordre du SQL dans chaque section', () => {
    const { viaItems } = splitResults(
      [itemRow('c', 'X'), itemRow('a', 'X'), itemRow('b', 'X')],
      new Set(),
    );
    assert.deepEqual(viaItems.map((v) => v.pseudo), ['c', 'a', 'b']);
  });

  it('reporte le nom d\'affichage et le coup de cœur', () => {
    const { accounts } = splitResults(
      [pseudoRow('keremasan', { display_name: 'Clément', is_featured: true })],
      new Set(),
    );
    assert.equal(accounts[0]?.displayName, 'Clément');
    assert.equal(accounts[0]?.isFeatured, true);
  });

  it('rend deux sections vides sur une entrée vide', () => {
    const results = splitResults([], new Set());
    assert.deepEqual(results, { accounts: [], viaItems: [] });
    assert.equal(isEmpty(results), true);
  });
});

describe('splitResults, pseudos bloqués', () => {
  it('retire un compte bloqué', () => {
    const { accounts } = splitResults([pseudoRow('gênant'), pseudoRow('ok')], new Set(['gênant']));
    assert.deepEqual(accounts.map((a) => a.pseudo), ['ok']);
  });

  /**
   * Un blocage posé depuis `/u/Dark_Hifus` ne doit pas être contourné par un
   * résultat qui renvoie le même pseudo dans une autre casse.
   */
  it('ignore la casse', () => {
    const { accounts } = splitResults([pseudoRow('Dark_Hifus')], new Set(['dark_hifus']));
    assert.equal(accounts.length, 0);
  });

  it('filtre aussi la section des items', () => {
    const { viaItems } = splitResults(
      [itemRow('gênant', 'Inception'), itemRow('ok', 'Inception')],
      new Set(['gênant']),
    );
    assert.deepEqual(viaItems.map((v) => v.pseudo), ['ok']);
  });
});

describe('mapSearchRow, cas limites', () => {
  /**
   * Une 7e catégorie déployée en base avant les clients. La personne existe
   * et son bento est publié : la faire disparaître des résultats serait pire
   * que de perdre la mention de l'item.
   */
  it('garde la ligne quand la catégorie est inconnue, sans sa raison', () => {
    const { accounts, viaItems } = splitResults([itemRow('naorii', 'Truc', 99)], new Set());
    assert.equal(viaItems.length, 0);
    assert.equal(accounts.length, 1);
    assert.equal(accounts[0]?.pseudo, 'naorii');
    assert.equal(accounts[0]?.item, null);
  });

  it('garde la ligne quand l\'item est incomplet', () => {
    const { accounts } = splitResults(
      [itemRow('naorii', 'Truc', 1, { item_id: null })],
      new Set(),
    );
    assert.equal(accounts.length, 1);
    assert.equal(accounts[0]?.item, null);
  });

  /**
   * Une valeur inconnue de `match_kind` ne peut pas être classée sans
   * mentir sur la raison du résultat. Elle est omise.
   */
  it('ignore une ligne au match_kind inattendu', () => {
    const rogue = pseudoRow('x', { match_kind: 'alias' });
    assert.equal(mapSearchRow(rogue), null);
    assert.equal(isEmpty(splitResults([rogue], new Set())), true);
  });
});

describe('matchAccessibilityLabel', () => {
  const base: SearchMatch = {
    bentoId: 'b',
    slug: 'mon-bento',
    isPrimary: true,
    pseudo: 'ralgan',
    displayName: null,
    isFeatured: false,
    item: null,
  };

  it('annonce simplement un compte', () => {
    assert.equal(matchAccessibilityLabel(base), 'Voir le bento de @ralgan');
  });

  it('annonce la raison d\'une correspondance par item', () => {
    assert.equal(
      matchAccessibilityLabel({
        ...base,
        item: { id: 'i', title: 'Inception', category: 'film' },
      }),
      'Voir le bento de @ralgan, qui a Inception dans sa case film',
    );
  });

  it('accorde le libellé de catégorie en minuscules', () => {
    assert.match(
      matchAccessibilityLabel({
        ...base,
        item: { id: 'i', title: 'Orelsan', category: 'track' },
      }),
      /dans sa case chanson$/,
    );
  });

  it('intègre le nom d\'affichage quand il existe', () => {
    assert.equal(
      matchAccessibilityLabel({ ...base, displayName: 'Clément' }),
      'Voir le bento de @ralgan, Clément',
    );
  });
});

describe('sharedItemAccessibilityLabel', () => {
  it('énonce le nombre de bentos', () => {
    assert.equal(
      sharedItemAccessibilityLabel({ id: 'i', title: 'Angers', category: 'place', picks: 4 }),
      'Chercher Angers, présent dans 4 bentos',
    );
  });
});

describe('sharedItemQuery', () => {
  const item = (title: string) => ({ id: 'i', title, category: 'track' as const, picks: 2 });

  it('rend le titre tel quel quand il est déjà propre', () => {
    assert.equal(sharedItemQuery(item('Inception')), 'Inception');
  });

  /**
   * La puce affiche `cleanTitle`, donc la barre doit porter la même chose :
   * sinon on touche « mia paper planes » et la barre affiche autre chose.
   */
  it('retire les parenthèses, comme la puce', () => {
    assert.equal(sharedItemQuery(item('mia paper planes (larsht_ edit)')), 'mia paper planes');
  });

  /**
   * Le piège que cette fonction existe pour éviter : la forme affichée est
   * tronquée à 28 caractères avec une ellipsis, et `ilike '%…%'` ne
   * correspond à rien. La puce ne trouverait pas l'item qu'elle annonce.
   */
  it('ne tronque pas, contrairement à ce que la puce affiche', () => {
    const long = "Le Seigneur des anneaux : La Communauté de l'anneau";
    assert.equal(sharedItemQuery(item(long)), long);
    assert.ok(!sharedItemQuery(item(long)).includes('…'));
  });

  it('se replie sur le titre brut si le nettoyage vide la chaîne', () => {
    assert.equal(sharedItemQuery(item('(instrumental)')), '(instrumental)');
  });

  it('rend toujours une chaîne cherchable', () => {
    for (const t of ['Angers', 'Joyca', '(x)', 'A (b) (c)', 'Hans Zimmer']) {
      assert.ok(sharedItemQuery(item(t)).trim().length >= 2, t);
    }
  });
});
