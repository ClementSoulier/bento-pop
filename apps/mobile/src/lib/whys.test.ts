import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAIN_CASES, type CaseMeta } from '@bento-pop/supabase-mobile/bento';
import {
  WHY_MAX_LENGTH,
  canSaveWhy,
  changedWhys,
  cleanWhy,
  toOwnWhys,
  whyErrorKey,
  whyErrorMessage,
  whyLength,
  whyLineLabel,
  whyLines,
  whyRemaining,
} from './whys';

describe("le texte d'un pourquoi (D5)", () => {
  it('tient sur une ligne, sans blancs autour, comme set_bento_why le garde', () => {
    assert.equal(cleanWhy('  Le premier film\n\nvu au cinéma.  '), 'Le premier film vu au cinéma.');
  });

  it("n'est rien quand il n'est fait que de blancs", () => {
    assert.equal(cleanWhy(' \n\t '), '');
  });

  it('se compte par point de code, comme char_length', () => {
    assert.equal(whyLength('Danser 💃'), 8);
    assert.equal(whyRemaining('a'.repeat(100)), 20);
    assert.equal(whyRemaining('a'.repeat(121)), -1);
  });

  it("s'enregistre vide, il efface, ou jusqu'à 120 caractères", () => {
    assert.equal(canSaveWhy(''), true);
    assert.equal(canSaveWhy('a'.repeat(WHY_MAX_LENGTH)), true);
    assert.equal(canSaveWhy('a'.repeat(WHY_MAX_LENGTH + 1)), false);
    assert.equal(canSaveWhy(`  ${'a'.repeat(WHY_MAX_LENGTH)}  `), true);
  });
});

describe('les lignes de la section (D1)', () => {
  const slots = {
    film: { title: 'Inception' },
    series: { title: 'Twin Peaks' },
    track: { title: 'Bohemian Rhapsody' },
  };

  it("une par case expliquée et remplie, dans l'ordre des cases", () => {
    const lines = whyLines(MAIN_CASES, slots, {
      track: { id: 'w-son', body: 'Le refrain de mes vacances.' },
      film: { id: 'w-film', body: 'Le premier film vu au cinéma.' },
      place: { id: 'w-lieu', body: 'Une case vide ne se montre pas.' },
    });
    assert.deepEqual(
      lines.map((l) => [l.caseKey, l.whyId, l.label, l.title, l.body]),
      [
        ['film', 'w-film', 'FILM', 'Inception', 'Le premier film vu au cinéma.'],
        ['track', 'w-son', 'SON', 'Bohemian Rhapsody', 'Le refrain de mes vacances.'],
      ],
    );
  });

  it("rien quand aucune case n'est expliquée : la page ne change pas", () => {
    assert.deepEqual(whyLines(MAIN_CASES, slots, {}), []);
  });

  it("la question d'une édition étiquette sa case", () => {
    const cases: CaseMeta[] = [{ key: 'ed3_1', prompt: 'Le film que tu trouves surcoté', stamp: 'FILM', gender: 'm' }];
    const lines = whyLines(cases, { ed3_1: { title: 'Avatar' } }, { ed3_1: { id: 'w', body: 'Trop long.' } });
    assert.equal(lines[0]?.label, 'Le film que tu trouves surcoté');
  });

  it('son propriétaire lit les siens, masqués compris, avec le motif (D8)', () => {
    const own = toOwnWhys([
      { case_key: 'film', body: 'Le premier.', status: 'visible', hidden_reason: null, updated_at: '' },
      { case_key: 'series', body: 'Masqué.', status: 'hidden', hidden_reason: 'Spam ou arnaque', updated_at: '' },
    ]);
    const lines = whyLines(MAIN_CASES, slots, { film: { id: 'w', body: 'Ce que lit un autre.' } }, own);
    assert.deepEqual(
      lines.map((l) => [l.caseKey, l.whyId, l.body, l.hidden, l.hiddenReason]),
      [
        ['film', null, 'Le premier.', false, null],
        ['series', null, 'Masqué.', true, 'Spam ou arnaque'],
      ],
    );
  });

  it('se lit d\'un bloc au lecteur d\'écran', () => {
    const [line] = whyLines(MAIN_CASES, slots, { film: { id: 'w', body: 'Le premier film vu au cinéma.' } });
    assert.ok(line);
    assert.equal(whyLineLabel(line), 'Film : Inception. Pourquoi : Le premier film vu au cinéma.');
    assert.equal(
      whyLineLabel({ ...line, hidden: true, hiddenReason: 'Spam ou arnaque' }),
      "Film : Inception. Pourquoi : Le premier film vu au cinéma. Masqué par l'équipe : Spam ou arnaque.",
    );
  });
});

describe('ce que « Enregistrer » envoie', () => {
  it('les champs changés, nettoyés ; vidé, il efface ; inchangé, rien', () => {
    assert.deepEqual(
      changedWhys(
        { film: 'Le premier.', series: 'Le générique.', track: 'Le refrain.' },
        { film: '  Le premier.  ', series: '', track: 'Un autre refrain.', place: 'Chaque été.' },
      ),
      [
        { caseKey: 'series', body: '' },
        { caseKey: 'track', body: 'Un autre refrain.' },
        { caseKey: 'place', body: 'Chaque été.' },
      ],
    );
  });

  it("un champ vide qui l'était déjà ne part pas", () => {
    assert.deepEqual(changedWhys({}, { film: '   ' }), []);
  });
});

describe('les erreurs de la base, en phrases', () => {
  it('chaque clé de set_bento_why a sa phrase', () => {
    for (const key of ['why_refused_filter', 'why_invalid', 'why_too_fast', 'why_case_empty', 'why_not_yours', 'whys_closed']) {
      assert.equal(whyErrorKey(new Error(key)), key);
      assert.notEqual(whyErrorMessage(new Error(key)), 'Une erreur est survenue. Réessaie.');
    }
  });

  it('une coupure réseau se dit comme telle, l\'inattendu reste générique', () => {
    assert.equal(whyErrorMessage(new Error('Network request failed')), 'Pas de réseau. Réessaie dans un instant.');
    assert.equal(whyErrorKey(new Error('boom')), null);
    assert.equal(whyErrorMessage(new Error('boom')), 'Une erreur est survenue. Réessaie.');
  });
});
