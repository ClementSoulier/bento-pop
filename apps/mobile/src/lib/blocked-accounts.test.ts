import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  NO_BLOCKED_ACCOUNTS,
  blockedIndex,
  isBlockedAccount,
  migrateBlockedPseudos,
  parseBlockedEntries,
  withBlocked,
  withCurrentPseudos,
  withoutBlockedEntry,
} from './blocked-accounts';

/**
 * Le blocage par compte, chantier 21 (D8) : changer de pseudo ne lève plus un
 * blocage, et la liste d'avant, des pseudos, se reprend sans rien perdre.
 */

describe('isBlockedAccount', () => {
  const index = blockedIndex([
    { userId: 'u-1', pseudo: 'ancien' },
    { userId: null, pseudo: 'Orphelin' },
  ]);

  it('reconnaît un compte bloqué sous un autre pseudo', () => {
    assert.equal(isBlockedAccount(index, { userId: 'u-1', pseudo: 'nouveau' }), true);
  });

  it('reconnaît un pseudo bloqué sans compte, quelle que soit la casse', () => {
    assert.equal(isBlockedAccount(index, { userId: 'u-9', pseudo: 'ORPHELIN' }), true);
  });

  it('reconnaît un pseudo bloqué quand l’écran n’a pas l’identifiant', () => {
    assert.equal(isBlockedAccount(index, { pseudo: 'ancien' }), true);
  });

  it('laisse passer les autres', () => {
    assert.equal(isBlockedAccount(index, { userId: 'u-2', pseudo: 'autre' }), false);
    assert.equal(isBlockedAccount(NO_BLOCKED_ACCOUNTS, { userId: 'u-1', pseudo: 'ancien' }), false);
  });
});

describe('withBlocked et withoutBlockedEntry', () => {
  it('ajoute un compte une seule fois, sous son dernier pseudo, en minuscules', () => {
    const once = withBlocked([], { userId: 'u-1', pseudo: 'Alice' });
    const twice = withBlocked(once, { userId: 'u-1', pseudo: 'Alice2' });
    assert.deepEqual(twice, [{ userId: 'u-1', pseudo: 'alice2' }]);
  });

  it('débloque par le compte, même sous un autre pseudo', () => {
    const entries = [{ userId: 'u-1', pseudo: 'alice' }, { userId: 'u-2', pseudo: 'bob' }];
    assert.deepEqual(withoutBlockedEntry(entries, { userId: 'u-1', pseudo: 'renommee' }), [
      { userId: 'u-2', pseudo: 'bob' },
    ]);
  });

  it('débloque une entrée sans compte par son pseudo', () => {
    const entries = [{ userId: null, pseudo: 'orphelin' }, { userId: 'u-2', pseudo: 'bob' }];
    assert.deepEqual(withoutBlockedEntry(entries, { pseudo: 'Orphelin' }), [
      { userId: 'u-2', pseudo: 'bob' },
    ]);
  });
});

describe('migrateBlockedPseudos', () => {
  it('rattache chaque pseudo d’avant à son compte, sous son pseudo actuel', () => {
    const entries = migrateBlockedPseudos(
      ['alice', 'ancien_bob', 'disparu'],
      [
        { pseudo: 'alice', user_id: 'u-1', current_pseudo: 'alice' },
        { pseudo: 'ancien_bob', user_id: 'u-2', current_pseudo: 'Bob' },
      ],
    );
    assert.deepEqual(entries, [
      { userId: 'u-1', pseudo: 'alice' },
      { userId: 'u-2', pseudo: 'bob' },
      { userId: null, pseudo: 'disparu' },
    ]);
  });

  it('fond deux pseudos d’un même compte en une entrée', () => {
    const entries = migrateBlockedPseudos(
      ['bob', 'ancien_bob'],
      [
        { pseudo: 'bob', user_id: 'u-2', current_pseudo: 'bob' },
        { pseudo: 'ancien_bob', user_id: 'u-2', current_pseudo: 'bob' },
      ],
    );
    assert.deepEqual(entries, [{ userId: 'u-2', pseudo: 'bob' }]);
  });

  it('ignore les pseudos vides', () => {
    assert.deepEqual(migrateBlockedPseudos(['  ', ''], []), []);
  });
});

describe('withCurrentPseudos', () => {
  it('renomme les comptes qui ont changé de pseudo, et laisse les autres', () => {
    const entries = [
      { userId: 'u-1', pseudo: 'ancien' },
      { userId: null, pseudo: 'orphelin' },
      { userId: 'u-3', pseudo: 'inconnu' },
    ];
    assert.deepEqual(withCurrentPseudos(entries, new Map([['u-1', 'Nouveau']])), [
      { userId: 'u-1', pseudo: 'nouveau' },
      { userId: null, pseudo: 'orphelin' },
      { userId: 'u-3', pseudo: 'inconnu' },
    ]);
  });
});

describe('parseBlockedEntries', () => {
  it('dit qu’il n’y a rien quand la clé est absente', () => {
    assert.equal(parseBlockedEntries(null), null);
  });

  it('lit une liste rangée, et tolère une valeur illisible', () => {
    assert.deepEqual(parseBlockedEntries('[{"userId":"u-1","pseudo":"Alice"},{"pseudo":"bob"},{"x":1}]'), [
      { userId: 'u-1', pseudo: 'alice' },
      { userId: null, pseudo: 'bob' },
    ]);
    assert.deepEqual(parseBlockedEntries('pas du json'), []);
    assert.deepEqual(parseBlockedEntries('{"pseudo":"seul"}'), []);
  });
});
