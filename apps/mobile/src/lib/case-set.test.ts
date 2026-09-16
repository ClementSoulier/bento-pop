import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CATEGORY_IDS, CATEGORY_ORDER } from '@bento-pop/supabase-mobile/bento';
import { MAIN_CASE_SET, caseIdByKey, caseKeyById } from './case-set';
import { composeCta, firstEmptyCase } from './compose-cta';
import { publishItemsFromSlots } from './bento-actions-pure';

/**
 * Le jeu de cases, et ce qui en dépend.
 *
 * Depuis le chantier 13, le composer n'édite plus « les six cases » mais
 * « les cases du bento courant » : six pour le principal, de deux à six pour
 * une édition. Ces tests éprouvent que le bento principal est exactement ce
 * qu'il était, et qu'une édition passe par les mêmes fonctions.
 */

/** Une édition à trois cases, telle que la base la rendrait. */
const EDITION = [
  { id: 101, key: 'ed7_1', prompt: 'Le film qui t’a fait pleurer', stamp: 'FILM', gender: 'm' as const },
  { id: 102, key: 'ed7_2', prompt: 'La série que tu caches', stamp: 'SÉRIE', gender: 'f' as const },
  { id: 103, key: 'ed7_3', prompt: 'Le son de ton été', stamp: 'SON', gender: 'm' as const },
];

describe('le jeu du bento principal', () => {
  it('reprend les six cases dans l’ordre de la boîte', () => {
    assert.deepEqual(MAIN_CASE_SET.map((c) => c.key), [...CATEGORY_ORDER]);
  });

  it('porte les identifiants du seed, ceux que `bento_items` référence', () => {
    for (const c of MAIN_CASE_SET) {
      assert.equal(c.id, CATEGORY_IDS[c.key as keyof typeof CATEGORY_IDS], c.key);
    }
    assert.deepEqual(MAIN_CASE_SET.map((c) => c.id), [1, 2, 3, 4, 5, 6]);
  });

  it('porte un intitulé, un tampon et un genre pour chaque case', () => {
    for (const c of MAIN_CASE_SET) {
      assert.ok(c.prompt.length > 0, c.key);
      assert.ok(c.stamp.length > 0, c.key);
      assert.ok(c.gender === 'm' || c.gender === 'f', c.key);
    }
  });
});

describe('les correspondances', () => {
  it('relit une case par son identifiant', () => {
    assert.equal(caseKeyById(MAIN_CASE_SET).get(1), 'film');
    assert.equal(caseKeyById(EDITION).get(102), 'ed7_2');
  });

  it('écrit une case par sa clé', () => {
    assert.equal(caseIdByKey(MAIN_CASE_SET).get('place'), 6);
    assert.equal(caseIdByKey(EDITION).get('ed7_3'), 103);
  });

  it('ne confond pas deux jeux', () => {
    // Le piège du chantier 13 : `slots` s'indexe par clé, donc une clé
    // d'édition ne doit jamais résoudre vers une case du bento principal.
    assert.equal(caseIdByKey(MAIN_CASE_SET).get('ed7_1'), undefined);
    assert.equal(caseIdByKey(EDITION).get('film'), undefined);
  });
});

describe('le bouton du composer, sur une édition', () => {
  it('oriente vers la première case et nomme sa question', () => {
    const r = composeCta({
      cases: EDITION, filled: [], hasPending: false, publishing: false, published: false,
    });
    assert.equal(r.kind, 'open-slot');
    assert.equal(r.kind === 'open-slot' && r.caseKey, 'ed7_1');
    // Le libellé nommait « ton film » en dur : une édition ne commence pas
    // forcément par un film.
    assert.match(r.label, /le film qui t’a fait pleurer/i);
  });

  it('compte les cases de l’édition, pas six', () => {
    const r = composeCta({
      cases: EDITION, filled: ['ed7_1'], hasPending: false, publishing: false, published: false,
    });
    assert.equal(r.kind, 'open-slot');
    assert.match(r.label, /2 restants/);
  });

  it('propose de publier à trois cases remplies', () => {
    const r = composeCta({
      cases: EDITION,
      filled: ['ed7_1', 'ed7_2', 'ed7_3'],
      hasPending: false, publishing: false, published: false,
    });
    assert.equal(r.kind, 'publish');
  });

  it('ne trouve plus de case vide quand tout est rempli', () => {
    assert.equal(firstEmptyCase(EDITION, ['ed7_1', 'ed7_2', 'ed7_3']), null);
  });
});

describe('publier une édition', () => {
  it('rend les identifiants de SES cases, pas ceux du bento principal', () => {
    const items = publishItemsFromSlots(
      {
        ed7_1: { title: 'Interstellar', paletteKey: 'tokyo', itemId: 'it-a' },
        ed7_3: { title: 'La Quête', paletteKey: 'seoul', itemId: 'it-b' },
      },
      EDITION,
    );
    assert.deepEqual(items, [
      { category_id: 101, item_id: 'it-a' },
      { category_id: 103, item_id: 'it-b' },
    ]);
  });
});
