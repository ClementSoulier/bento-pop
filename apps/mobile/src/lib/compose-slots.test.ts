import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CaseSet } from './case-set';
import { MAIN_CASE_SET } from './case-set';
import { composerSlots, fillsBento } from './compose-slots';

const QUESTION: CaseSet = {
  id: 12,
  key: 'rec6_1',
  prompt: 'Le film que tu reverrais ce soir',
  stamp: 'FILM',
  gender: 'm',
  typeKey: 'film',
};
const TWO: CaseSet = {
  id: 13,
  key: 'rec6_2',
  prompt: 'Ton idole d’ado',
  stamp: 'ARTISTE',
  gender: 'f',
  typeKey: 'person',
};

describe('les cases du plateau', () => {
  it('donne à chaque case du bento principal sa catégorie, son libellé et son tampon', () => {
    const slots = composerSlots(MAIN_CASE_SET, {});
    assert.deepEqual(
      slots.map((slot) => [slot.key, slot.category, slot.label, slot.stamp, slot.question]),
      [
        ['film', 'film', 'Film', 'FILM', false],
        ['series', 'series', 'Série', 'SÉRIE', false],
        ['artist', 'artist', 'Artiste', 'ARTISTE', false],
        ['track', 'track', 'Chanson', 'SON', false],
        ['creator', 'creator', 'Créateur de contenu', 'CRÉA', false],
        ['place', 'place', 'Lieu', 'LIEU', false],
      ],
    );
  });

  it('porte la question d’une édition, et la catégorie de son type', () => {
    const [film, idole] = composerSlots([QUESTION, TWO], {});
    assert.equal(film?.question, true);
    assert.equal(film?.label, 'Le film que tu reverrais ce soir');
    assert.equal(film?.category, 'film');
    assert.equal(idole?.category, 'artist');
  });

  it('désigne la première case vide, seule à remplir maintenant', () => {
    const slots = composerSlots(MAIN_CASE_SET, { place: { title: 'Le Pont Neuf', pending: true } });
    assert.deepEqual(
      slots.filter((slot) => slot.next).map((slot) => slot.key),
      ['film'],
    );
    const later = composerSlots(MAIN_CASE_SET, { film: { title: 'Ponyo' } });
    assert.deepEqual(
      later.filter((slot) => slot.next).map((slot) => slot.key),
      ['series'],
    );
  });

  it('n’en désigne aucune sur un bento complet', () => {
    const full = Object.fromEntries(MAIN_CASE_SET.map((c) => [c.key, { title: c.prompt }]));
    assert.deepEqual(
      composerSlots(MAIN_CASE_SET, full).filter((slot) => slot.next),
      [],
    );
  });

  it('passe l’item au plateau, son titre nettoyé et son crédit', () => {
    const [film] = composerSlots(MAIN_CASE_SET, {
      film: {
        title: 'HugoDécrypte (média)',
        subtitle: '2010',
        imageUrl: 'https://exemple.test/a.png',
        imageCredit: 'Photo : X',
        pending: true,
      },
    });
    assert.deepEqual(film?.item, {
      title: 'HugoDécrypte',
      subtitle: '2010',
      credit: 'Photo : X',
      imageUrl: 'https://exemple.test/a.png',
      pending: true,
    });
  });
});

describe('remplir la dernière case (D13)', () => {
  const all = Object.fromEntries(MAIN_CASE_SET.map((c) => [c.key, { title: c.prompt }]));
  const without = (key: string) => {
    const copy: Partial<typeof all> = { ...all };
    delete copy[key];
    return copy;
  };

  it('complète le bento', () => {
    assert.equal(fillsBento(MAIN_CASE_SET, without('place'), 'place'), true);
  });

  it('ne dit rien tant qu’une autre case reste vide', () => {
    const two = without('place');
    delete two.film;
    assert.equal(fillsBento(MAIN_CASE_SET, two, 'place'), false);
  });

  it('ne célèbre pas un remplacement dans un bento déjà complet', () => {
    assert.equal(fillsBento(MAIN_CASE_SET, all, 'film'), false);
  });

  it('compte les cases d’une édition, pas les six du bento principal', () => {
    assert.equal(fillsBento([QUESTION, TWO], { rec6_1: { title: 'Ponyo' } }, 'rec6_2'), true);
  });
});
