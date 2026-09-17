import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PUSH_REFRESH_INTERVAL_MS,
  pushAskTitle,
  refreshPushRegistration,
  shouldOfferPushAsk,
  type PushPermission,
  type PushRegistrationDeps,
  type PushRegistrationMemory,
} from './push';

/**
 * Chantier 17, lot 2. Ce qui décide de la demande d'autorisation et de
 * l'enregistrement d'un appareil, sans module natif.
 */
describe('shouldOfferPushAsk', () => {
  it("propose la phrase quand l'autorisation manque et que le système peut encore demander", () => {
    assert.equal(shouldOfferPushAsk({ granted: false, canAskAgain: true }), true);
  });

  it('ne propose rien après un refus définitif : le « Oui » n’ouvrirait aucune boîte', () => {
    assert.equal(shouldOfferPushAsk({ granted: false, canAskAgain: false }), false);
  });

  it('ne propose rien quand tout est déjà accordé', () => {
    assert.equal(shouldOfferPushAsk({ granted: true, canAskAgain: true }), false);
    assert.equal(shouldOfferPushAsk({ granted: true, canAskAgain: false }), false);
  });
});

describe('pushAskTitle', () => {
  it("nomme l'item proposé", () => {
    assert.equal(pushAskTitle('Interstellar'), 'On te prévient quand « Interstellar » est validé ?');
  });

  it('ôte les espaces autour du titre', () => {
    assert.equal(pushAskTitle('  Dune  '), 'On te prévient quand « Dune » est validé ?');
  });

  it('se passe du titre quand il est vide', () => {
    assert.equal(pushAskTitle('   '), 'On te prévient quand ton item est validé ?');
  });
});

describe('refreshPushRegistration', () => {
  type Calls = { permission: number; token: number; register: [string, string][] };

  function setup(overrides: Partial<PushRegistrationDeps> & { granted?: PushPermission } = {}) {
    const calls: Calls = { permission: 0, token: 0, register: [] };
    let clock = 1_000_000;
    const deps: PushRegistrationDeps = {
      platform: 'ios',
      userId: () => 'compte-a',
      permission: async () => {
        calls.permission++;
        return overrides.granted ?? { granted: true, canAskAgain: true };
      },
      expoToken: async () => {
        calls.token++;
        return 'ExponentPushToken[appareil]';
      },
      register: async (token, platform) => {
        calls.register.push([token, platform]);
      },
      now: () => clock,
      ...overrides,
    };
    return { deps, calls, advance: (ms: number) => (clock += ms) };
  }

  it('ne fait rien sans session, pas même lire l’autorisation', async () => {
    const { deps, calls } = setup({ userId: () => null });
    const { outcome, memory } = await refreshPushRegistration(deps, null);
    assert.deepEqual(outcome, { state: 'skipped', reason: 'no-session' });
    assert.equal(memory, null);
    assert.equal(calls.permission, 0);
  });

  it('ne demande pas de jeton sans autorisation', async () => {
    const { deps, calls } = setup({ granted: { granted: false, canAskAgain: true } });
    const { outcome } = await refreshPushRegistration(deps, null);
    assert.deepEqual(outcome, { state: 'skipped', reason: 'not-granted' });
    assert.equal(calls.token, 0);
    assert.equal(calls.register.length, 0);
  });

  it("enregistre le jeton avec la plateforme, et s'en souvient", async () => {
    const { deps, calls } = setup({ platform: 'android' });
    const { outcome, memory } = await refreshPushRegistration(deps, null);
    assert.deepEqual(outcome, { state: 'registered', token: 'ExponentPushToken[appareil]' });
    assert.deepEqual(calls.register, [['ExponentPushToken[appareil]', 'android']]);
    assert.deepEqual(memory, { token: 'ExponentPushToken[appareil]', userId: 'compte-a', at: 1_000_000 });
  });

  it('ne refait pas un enregistrement récent du même compte', async () => {
    const { deps, calls, advance } = setup();
    const first = await refreshPushRegistration(deps, null);
    advance(PUSH_REFRESH_INTERVAL_MS - 1);
    const second = await refreshPushRegistration(deps, first.memory);
    assert.deepEqual(second.outcome, { state: 'skipped', reason: 'recent' });
    assert.equal(calls.token, 1);
    assert.equal(second.memory, first.memory);
  });

  it("refait l'enregistrement une fois l'intervalle passé", async () => {
    const { deps, calls, advance } = setup();
    const first = await refreshPushRegistration(deps, null);
    advance(PUSH_REFRESH_INTERVAL_MS);
    const second = await refreshPushRegistration(deps, first.memory);
    assert.equal(second.outcome.state, 'registered');
    assert.equal(calls.register.length, 2);
  });

  it('refait l’enregistrement tout de suite quand le compte a changé', async () => {
    // Une session anonyme perdue recrée un compte sur le même appareil : le
    // jeton doit passer au nouveau compte sans attendre une heure.
    const memory: PushRegistrationMemory = {
      token: 'ExponentPushToken[appareil]',
      userId: 'ancien-compte',
      at: 1_000_000,
    };
    const { deps, calls } = setup();
    const { outcome, memory: next } = await refreshPushRegistration(deps, memory);
    assert.equal(outcome.state, 'registered');
    assert.equal(calls.register.length, 1);
    assert.equal(next?.userId, 'compte-a');
  });

  it('force un enregistrement récent quand on le demande', async () => {
    const { deps, calls } = setup();
    const first = await refreshPushRegistration(deps, null);
    const second = await refreshPushRegistration(deps, first.memory, { force: true });
    assert.equal(second.outcome.state, 'registered');
    assert.equal(calls.register.length, 2);
  });

  it("rend l'échec du jeton sans lever, et garde la mémoire", async () => {
    const { deps } = setup({
      expoToken: async () => {
        throw new Error('pas de google-services.json');
      },
    });
    // Un enregistrement ancien, pour que la tentative ait bien lieu.
    const memory: PushRegistrationMemory = {
      token: 't',
      userId: 'compte-a',
      at: 1_000_000 - PUSH_REFRESH_INTERVAL_MS,
    };
    const result = await refreshPushRegistration(deps, memory);
    assert.equal(result.outcome.state, 'failed');
    assert.equal(result.outcome.state === 'failed' && result.outcome.step, 'token');
    assert.equal(result.memory, memory);
  });

  it("rend l'échec de l'enregistrement sans lever", async () => {
    const { deps } = setup({
      register: async () => {
        throw new Error('réseau');
      },
    });
    const result = await refreshPushRegistration(deps, null);
    assert.equal(result.outcome.state === 'failed' && result.outcome.step, 'register');
    assert.equal(result.memory, null);
  });

  it("rend l'échec de lecture de l'autorisation sans lever", async () => {
    const { deps } = setup({
      permission: async () => {
        throw new Error('module natif absent');
      },
    });
    const result = await refreshPushRegistration(deps, null);
    assert.equal(result.outcome.state === 'failed' && result.outcome.step, 'permission');
  });
});
