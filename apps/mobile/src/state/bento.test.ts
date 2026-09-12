import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { useBento } from './bento';

const FILM = { title: 'Inception', itemId: 'item-inception' };
const SERIE = { title: 'Breaking Bad', itemId: 'item-bb' };

beforeEach(() => {
  useBento.getState().reset();
});

const state = () => useBento.getState();

describe('cases', () => {
  it('pose, remplace et retire une case', () => {
    state().setSlot('film', FILM);
    assert.deepEqual(state().slots.film, FILM);

    state().setSlot('film', SERIE);
    assert.deepEqual(state().slots.film, SERIE);

    state().clearSlot('film');
    assert.equal(state().slots.film, undefined);
    assert.equal(state().filledCount(), 0);
  });

  it('retirer une case absente ne jette pas', () => {
    state().clearSlot('place');
    assert.equal(state().filledCount(), 0);
  });
});

describe('hydrate face aux écritures en vol', () => {
  it('applique l\'état distant quand rien n\'est en vol', () => {
    state().setSlot('film', FILM);
    state().hydrate({ series: SERIE });
    assert.equal(state().slots.film, undefined, 'hydrate remplace, il ne fusionne pas');
    assert.deepEqual(state().slots.series, SERIE);
  });

  /**
   * Le scénario exact que le tap unique a rendu possible : la modale se
   * ferme avant que l'écriture n'aboutisse, le composer reprend le focus et
   * relit un bento qui ne contient pas encore la case. Sans ce verrou, la
   * tuile qu'on vient d'afficher disparaît sous les yeux de l'utilisateur
   * pendant que l'écriture, elle, réussit.
   */
  it('ignore l\'état distant tant qu\'une écriture n\'est pas confirmée', () => {
    state().beginWrite();
    state().setSlot('film', FILM);

    // Le composer relit la base, qui ne connaît pas encore `film`.
    state().hydrate({});
    assert.deepEqual(state().slots.film, FILM, 'la case optimiste a été écrasée');

    state().endWrite();
    // Une fois l'écriture confirmée, la base redevient la référence.
    state().hydrate({ film: FILM, series: SERIE });
    assert.deepEqual(state().slots.series, SERIE);
  });

  it('reste bloqué tant que TOUTES les écritures ne sont pas confirmées', () => {
    state().beginWrite();
    state().beginWrite();
    state().setSlot('film', FILM);

    state().endWrite();
    state().hydrate({});
    assert.deepEqual(state().slots.film, FILM, 'débloqué trop tôt');

    state().endWrite();
    state().hydrate({});
    assert.equal(state().slots.film, undefined, 'toujours bloqué après la dernière');
  });

  /**
   * `endWrite` est appelé dans un `finally`. Un remaniement qui en placerait
   * un en trop rendrait le compteur négatif, et `hydrate` ne se rebloquerait
   * plus jamais : la synchronisation deviendrait silencieusement cassée pour
   * le reste de la session.
   */
  it('ne descend jamais sous zéro', () => {
    state().endWrite();
    state().endWrite();
    assert.equal(state().pendingWrites, 0);

    state().beginWrite();
    state().setSlot('film', FILM);
    state().hydrate({});
    assert.deepEqual(state().slots.film, FILM, 'le verrou ne protège plus rien');
  });

  it('reset repart d\'un compteur propre', () => {
    state().beginWrite();
    state().reset();
    assert.equal(state().pendingWrites, 0);
    state().hydrate({ film: FILM });
    assert.deepEqual(state().slots.film, FILM);
  });
});
