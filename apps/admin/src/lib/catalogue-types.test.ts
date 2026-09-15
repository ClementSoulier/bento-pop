import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  deactivationBlocker,
  explainTypeError,
  findDuplicateGroups,
  normalizeTitle,
  retypeBlockers,
  validateItemTypeInput,
  type DuplicateCandidate,
} from './catalogue-types';

describe('validateItemTypeInput', () => {
  it('accepte une clé en minuscules et un libellé', () => {
    const r = validateItemTypeInput({ key: 'board_game', label: ' Jeu de société ', order: 10 });
    assert.deepEqual(r, {
      ok: true,
      value: { key: 'board_game', label: 'Jeu de société', order: 10 },
    });
  });

  it('refuse une clé que la contrainte SQL refuserait', () => {
    for (const key of ['Jeu', 'jv', '1jeu', 'jeu-video', 'a'.repeat(21)]) {
      assert.equal(validateItemTypeInput({ key, label: 'x', order: 0 }).ok, false, key);
    }
  });

  it('refuse un libellé vide ou trop long', () => {
    assert.equal(validateItemTypeInput({ key: 'manga', label: '   ', order: 0 }).ok, false);
    assert.equal(
      validateItemTypeInput({ key: 'manga', label: 'x'.repeat(41), order: 0 }).ok,
      false,
    );
  });

  it('refuse un ordre qui n’est pas un entier de 0 à 999', () => {
    for (const order of [-1, 1.5, 1000, Number.NaN]) {
      assert.equal(
        validateItemTypeInput({ key: 'manga', label: 'Manga', order }).ok,
        false,
        String(order),
      );
    }
  });
});

describe('deactivationBlocker', () => {
  it('bloque un type porté par une case du bento principal, nommée par son intitulé', () => {
    assert.equal(
      deactivationBlocker({ cases: ['Film'] }),
      'Porté par la case Film du bento principal : le désactiver viderait sa recherche.',
    );
  });

  it('accorde le message quand plusieurs cases portent le type', () => {
    assert.equal(
      deactivationBlocker({ cases: ['Artiste musical', 'Créateur de contenu'] }),
      'Porté par les cases Artiste musical et Créateur de contenu du bento principal : le désactiver viderait leur recherche.',
    );
    assert.match(deactivationBlocker({ cases: ['A', 'B', 'C'] }) ?? '', /les cases A, B et C du/);
  });

  it('laisse désactiver un type sans case', () => {
    assert.equal(deactivationBlocker({ cases: [] }), null);
  });
});

describe('normalizeTitle', () => {
  it('rejoint casse, accents et ponctuation', () => {
    assert.equal(normalizeTitle('Joueur du Grenier'), normalizeTitle('joueur du grenier'));
    assert.equal(normalizeTitle('Pokémon : Rouge'), 'pokemon rouge');
    assert.equal(normalizeTitle('  lesadpanda!! '), 'lesadpanda');
  });
});

const item = (
  over: Partial<DuplicateCandidate> & { id: string; title: string },
): DuplicateCandidate => ({
  typeId: 3,
  status: 'validated',
  bentoCount: 0,
  hasImage: false,
  createdAt: '2026-05-01T00:00:00Z',
  ...over,
});

describe('findDuplicateGroups', () => {
  /**
   * Le cas qui a motivé l'encart : avant le chantier 15, un même vidéaste
   * existait comme artiste et comme créateur. Une fois tous deux Personnes,
   * ils doivent se retrouver côte à côte.
   */
  it('rapproche deux Personnes au même titre', () => {
    const groups = findDuplicateGroups([
      item({ id: 'a', title: 'Joueur du Grenier', bentoCount: 3 }),
      item({ id: 'b', title: 'joueur du grenier', bentoCount: 1 }),
      item({ id: 'c', title: 'Amixem' }),
    ]);
    assert.equal(groups.length, 1);
    assert.deepEqual(
      groups[0]?.items.map((i) => i.id),
      ['a', 'b'],
    );
  });

  it('ne rapproche pas deux types différents', () => {
    const groups = findDuplicateGroups([
      item({ id: 'a', title: 'Arcane', typeId: 2 }),
      item({ id: 'b', title: 'Arcane', typeId: 3 }),
    ]);
    assert.equal(groups.length, 0);
  });

  it('écarte les fusionnés et les refusés', () => {
    const groups = findDuplicateGroups([
      item({ id: 'a', title: 'Queen' }),
      item({ id: 'b', title: 'Queen', status: 'merged' }),
      item({ id: 'c', title: 'Queen', status: 'rejected' }),
    ]);
    assert.equal(groups.length, 0);
  });

  it('propose le validé, puis le plus posé, puis l’illustré, puis le plus ancien', () => {
    const [group] = findDuplicateGroups([
      item({ id: 'brouillon', title: 'Orelsan', status: 'draft', bentoCount: 9 }),
      item({ id: 'recent', title: 'Orelsan', createdAt: '2026-09-01T00:00:00Z', hasImage: true }),
      item({ id: 'ancien', title: 'Orelsan', createdAt: '2026-05-01T00:00:00Z', hasImage: true }),
      item({ id: 'pose', title: 'Orelsan', bentoCount: 2 }),
    ]);
    assert.deepEqual(
      group?.items.map((i) => i.id),
      ['pose', 'ancien', 'recent', 'brouillon'],
    );
  });
});

describe('retypeBlockers', () => {
  it('ne garde que les cases d’un autre type que le nouveau', () => {
    const usage = [
      { bentoId: 'b1', caseKey: 'creator', caseLabel: 'Créateur de contenu', caseTypeId: 3 },
      { bentoId: 'b2', caseKey: 'series', caseLabel: 'Série', caseTypeId: 2 },
    ];
    assert.deepEqual(
      retypeBlockers(usage, 2).map((u) => u.bentoId),
      ['b1'],
    );
    assert.equal(retypeBlockers([], 2).length, 0);
  });
});

describe('explainTypeError', () => {
  it('traduit les deux refus de la base', () => {
    const posed = explainTypeError({
      code: '23514',
      message: "Cet item est posé dans une case d'un autre type.",
    });
    assert.match(posed, /retire-le de ces bentos/);
    // Une fusion ne réunit que des items du même type : elle ne débloque rien.
    assert.doesNotMatch(posed, /fusionne/);
    assert.match(
      explainTypeError({ code: '23514', message: "Cet item n'est pas du type de la case." }),
      /pas du type de la case/,
    );
  });

  it('traduit une clé en double', () => {
    assert.equal(
      explainTypeError({ code: '23505', message: 'duplicate key' }),
      'Cette clé de type existe déjà.',
    );
  });

  it('laisse passer le reste tel quel', () => {
    assert.equal(explainTypeError({ message: 'réseau' }), 'réseau');
  });
});
