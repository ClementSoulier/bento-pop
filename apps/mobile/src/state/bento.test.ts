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

describe('lastFilled, déclencheur de la pulsation', () => {
  it('est nul au départ', () => {
    assert.equal(state().lastFilled, null);
  });

  it('désigne la dernière case posée', () => {
    state().setSlot('film', FILM);
    assert.equal(state().lastFilled?.caseKey, 'film');
    state().setSlot('series', SERIE);
    assert.equal(state().lastFilled?.caseKey, 'series');
  });

  /**
   * Sans compteur, remplacer deux fois de suite l'item d'une même case
   * laisserait `lastFilled` identique et l'animation ne se rejouerait pas.
   */
  it('incrémente son jeton à chaque pose, même sur la même case', () => {
    state().setSlot('film', FILM);
    const first = state().lastFilled?.seq;
    state().setSlot('film', SERIE);
    const second = state().lastFilled?.seq;
    assert.ok(first !== undefined && second !== undefined);
    assert.ok(second > first, `${second} devrait dépasser ${first}`);
  });

  /**
   * Le point qui compte : au démarrage à froid, `hydrate` remplit les six
   * cases d'un coup. Si elle touchait `lastFilled`, les six tuiles
   * pulseraient à l'ouverture de l'app.
   */
  it("n'est pas touché par une resynchronisation", () => {
    state().hydrate({ film: FILM, series: SERIE });
    assert.equal(state().lastFilled, null);

    state().setSlot('place', FILM);
    const after = state().lastFilled;
    state().hydrate({ film: FILM });
    assert.deepEqual(state().lastFilled, after, 'hydrate a bougé le déclencheur');
  });

  it('repart de zéro sur reset', () => {
    state().setSlot('film', FILM);
    state().reset();
    assert.equal(state().lastFilled, null);
  });
});

describe('hydrate face aux écritures en vol', () => {
  it("applique l'état distant quand rien n'est en vol", () => {
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
  it("ignore l'état distant tant qu'une écriture n'est pas confirmée", () => {
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

  it("reset repart d'un compteur propre", () => {
    state().beginWrite();
    state().reset();
    assert.equal(state().pendingWrites, 0);
    state().hydrate({ film: FILM });
    assert.deepEqual(state().slots.film, FILM);
  });
});

/**
 * Ce que le composer attend pour montrer autre chose qu'un squelette. Il ne
 * l'attend pas qu'en cas de succès : un compte sans bento, une ligne sans
 * cases ou une lecture qui échoue doivent le débloquer aussi, sinon
 * « Chargement… » ne s'en va jamais. Relevé au chantier 11 sur l'émulateur
 * Pixel 8, dont le compte n'avait pas encore de bento.
 */
describe('première lecture', () => {
  it('commence non hydraté', () => {
    assert.equal(state().hydrated, false);
  });

  it('est hydraté par une lecture qui rapporte des cases', () => {
    state().hydrate({ film: FILM });
    assert.equal(state().hydrated, true);
  });

  it('est hydraté par une lecture vide', () => {
    state().hydrate({});
    assert.equal(state().hydrated, true);
  });

  it('est hydraté même quand une écriture est en vol', () => {
    state().beginWrite();
    state().hydrate({});
    assert.equal(state().hydrated, true);
  });

  it('se marque hydraté sans toucher aux cases', () => {
    state().setSlot('film', FILM);
    state().markHydrated();
    assert.equal(state().hydrated, true);
    assert.deepEqual(state().slots.film, FILM, 'une lecture en échec a effacé une case');
  });

  it('redevient non hydraté sur reset', () => {
    state().hydrate({});
    state().reset();
    assert.equal(state().hydrated, false);
  });
});
