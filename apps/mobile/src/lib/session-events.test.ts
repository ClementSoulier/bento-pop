import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sessionEventAction } from './session-events';

const A = 'compte-a';
const B = 'compte-b';

describe('sessionEventAction', () => {
  /** D5 : le lancement a ouvert l'app sans compte, la session arrive ensuite. */
  it('relit le profil quand la session attendue arrive', () => {
    assert.equal(
      sessionEventAction({ event: 'TOKEN_REFRESHED', userId: A, previousUserId: null, steering: false }),
      'reload-profile',
    );
    assert.equal(
      sessionEventAction({ event: 'INITIAL_SESSION', userId: A, previousUserId: null, steering: false }),
      'reload-profile',
    );
  });

  it('relit le profil quand le compte change', () => {
    assert.equal(
      sessionEventAction({ event: 'SIGNED_IN', userId: B, previousUserId: A, steering: false }),
      'reload-profile',
    );
  });

  it('ne relit rien à un simple renouvellement du même compte', () => {
    assert.equal(
      sessionEventAction({ event: 'TOKEN_REFRESHED', userId: A, previousUserId: A, steering: false }),
      'none',
    );
    assert.equal(
      sessionEventAction({ event: 'USER_UPDATED', userId: A, previousUserId: A, steering: false }),
      'none',
    );
  });

  /** D6 : `auth-js` a effacé une session refusée, personne ne l'a demandé. */
  it('signale une session perdue quand elle disparaît sans qu’on l’ait demandé', () => {
    assert.equal(
      sessionEventAction({ event: 'SIGNED_OUT', userId: null, previousUserId: A, steering: false }),
      'session-lost',
    );
  });

  it('ne décide rien pendant que l’app conduit : lancement, changement de compte, déconnexion voulue', () => {
    for (const event of ['SIGNED_OUT', 'SIGNED_IN', 'TOKEN_REFRESHED'] as const) {
      assert.equal(sessionEventAction({ event, userId: B, previousUserId: A, steering: true }), 'none');
    }
  });
});
