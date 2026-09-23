import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PUSH_REFRESH_INTERVAL_MS,
  coalescePushRefresh,
  notificationSection,
  planItemTarget,
  pushAskTitle,
  pushTargetFromData,
  refreshPushRegistration,
  shouldOfferEditorialAsk,
  shouldOfferPushAsk,
  type PushPermission,
  type PushRegistrationDeps,
  type PushRegistrationMemory,
  type PushRegistrationOutcome,
  type PushTarget,
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

describe('coalescePushRefresh', () => {
  /** Une tentative qu'on termine à la main, pour tenir deux appels simultanés. */
  function manualRun() {
    const calls: boolean[] = [];
    const pending: ((outcome: PushRegistrationOutcome) => void)[] = [];
    const run = (force: boolean) => {
      calls.push(force);
      return new Promise<PushRegistrationOutcome>((resolve) => pending.push(resolve));
    };
    return { run, calls, finish: (i: number, outcome: PushRegistrationOutcome) => pending[i]?.(outcome) };
  }

  const registered: PushRegistrationOutcome = { state: 'registered', token: 'ExponentPushToken[a]' };
  const notGranted: PushRegistrationOutcome = { state: 'skipped', reason: 'not-granted' };

  it('deux appels simultanés partagent une seule tentative', async () => {
    const { run, calls, finish } = manualRun();
    const refresh = coalescePushRefresh(run);
    const first = refresh();
    const second = refresh();
    finish(0, registered);
    assert.deepEqual(await first, registered);
    assert.deepEqual(await second, registered);
    assert.deepEqual(calls, [false]);
  });

  it('un appel forcé partage une tentative qui a enregistré l’appareil', async () => {
    const { run, calls, finish } = manualRun();
    const refresh = coalescePushRefresh(run);
    const background = refresh();
    const forced = refresh(true);
    finish(0, registered);
    assert.deepEqual(await background, registered);
    assert.deepEqual(await forced, registered);
    assert.deepEqual(calls, [false]);
  });

  it("un appel forcé refait une tentative qui a lu l'autorisation trop tôt", async () => {
    // Le retour au premier plan a lu « pas autorisé » juste avant que la boîte
    // du système ne rende son accord.
    const { run, calls, finish } = manualRun();
    const refresh = coalescePushRefresh(run);
    const background = refresh();
    const forced = refresh(true);
    finish(0, notGranted);
    assert.deepEqual(await background, notGranted);
    await new Promise((resolve) => setImmediate(resolve));
    finish(1, registered);
    assert.deepEqual(await forced, registered);
    assert.deepEqual(calls, [false, true]);
  });

  it('une fois la tentative finie, un nouvel appel en refait une', async () => {
    const { run, calls, finish } = manualRun();
    const refresh = coalescePushRefresh(run);
    const first = refresh();
    finish(0, notGranted);
    await first;
    const second = refresh();
    finish(1, registered);
    assert.deepEqual(await second, registered);
    assert.deepEqual(calls, [false, false]);
  });
});

/**
 * Chantier 17, lot 4. Ce qu'ouvre le tap d'une notification, ce que montre la
 * section du profil, et quand proposer l'accord éditorial.
 */
const ITEM = '0f8d7a3c-2b1e-4c5d-9e6f-7a8b9c0d1e2f';
const KEPT = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

describe('pushTargetFromData', () => {
  it('une validation mène à son item', () => {
    assert.deepEqual(pushTargetFromData({ type: 'item_moderated', status: 'validated', itemId: ITEM }), {
      kind: 'item',
      status: 'validated',
      itemId: ITEM,
      keptItemId: null,
    });
  });

  it('une fusion garde l’item conservé', () => {
    const target = pushTargetFromData({
      type: 'item_moderated',
      status: 'merged',
      itemId: ITEM,
      keptItemId: KEPT,
    });
    assert.equal(target?.kind === 'item' && target.keptItemId, KEPT);
  });

  it('un item conservé mal formé est ignoré, pas la notification', () => {
    const target = pushTargetFromData({ type: 'item_moderated', status: 'merged', itemId: ITEM, keptItemId: 'x' });
    assert.equal(target?.kind === 'item' && target.keptItemId, null);
  });

  it('une édition mène à son identifiant, nombre ou chiffres', () => {
    assert.deepEqual(pushTargetFromData({ type: 'edition_released', editionId: 7, slug: 'x' }), {
      kind: 'edition',
      editionId: 7,
    });
    assert.deepEqual(pushTargetFromData({ type: 'edition_released', editionId: '7' }), {
      kind: 'edition',
      editionId: 7,
    });
  });

  it('rien d’inattendu ne mène nulle part', () => {
    const refus: unknown[] = [
      null,
      undefined,
      'item_moderated',
      [],
      {},
      { type: 'autre', itemId: ITEM },
      { type: 'item_moderated', status: 'pending', itemId: ITEM },
      { type: 'item_moderated', status: 'validated', itemId: 'pas-un-uuid' },
      { type: 'item_moderated', status: 'validated' },
      { type: 'edition_released', editionId: 0 },
      { type: 'edition_released', editionId: -3 },
      { type: 'edition_released', editionId: 2.5 },
      { type: 'edition_released', editionId: 40000 },
      { type: 'edition_released', editionId: '7; drop' },
      { type: 'edition_released', url: 'https://ailleurs.example' },
    ];
    for (const data of refus) assert.equal(pushTargetFromData(data), null, JSON.stringify(data));
  });
});

describe('planItemTarget', () => {
  const valide = (over: Partial<Extract<PushTarget, { kind: 'item' }>> = {}) => ({
    kind: 'item' as const,
    status: 'validated' as const,
    itemId: ITEM,
    keptItemId: null,
    ...over,
  });
  const rien = { shown: [], placements: [], currentBentoId: 'courant', primaryBentoId: 'principal' };

  it('l’item dans ce que le composer affiche, brouillon compris : on reste', () => {
    const plan = planItemTarget(valide(), { ...rien, shown: [{ caseKey: 'film', itemId: ITEM }] });
    assert.deepEqual(plan, { where: 'shown', caseKey: 'film', openSearch: false });
  });

  it('un refus ouvre en plus la recherche de la case (D22)', () => {
    const plan = planItemTarget(valide({ status: 'rejected' }), {
      ...rien,
      shown: [{ caseKey: 'film', itemId: ITEM }],
    });
    assert.equal(plan?.openSearch, true);
  });

  it('une fusion cherche d’abord l’item conservé', () => {
    const plan = planItemTarget(valide({ status: 'merged', keptItemId: KEPT }), {
      ...rien,
      shown: [
        { caseKey: 'livre', itemId: ITEM },
        { caseKey: 'film', itemId: KEPT },
      ],
    });
    assert.deepEqual(plan, { where: 'shown', caseKey: 'film', openSearch: false });
  });

  it('dans un autre bento : celui qu’on édite, puis le principal, puis un autre', () => {
    const ailleurs = { bentoId: 'autre', categoryId: 3, itemId: ITEM };
    const principal = { bentoId: 'principal', categoryId: 1, itemId: ITEM };
    const courant = { bentoId: 'courant', categoryId: 2, itemId: ITEM };
    assert.deepEqual(planItemTarget(valide(), { ...rien, placements: [ailleurs, principal, courant] }), {
      where: 'bento',
      bentoId: 'courant',
      categoryId: 2,
      openSearch: false,
    });
    assert.equal(planItemTarget(valide(), { ...rien, placements: [ailleurs, principal] })?.where, 'bento');
    assert.deepEqual(
      planItemTarget(valide(), { ...rien, placements: [ailleurs, principal] }),
      { where: 'bento', bentoId: 'principal', categoryId: 1, openSearch: false },
    );
    assert.deepEqual(planItemTarget(valide(), { ...rien, placements: [ailleurs] }), {
      where: 'bento',
      bentoId: 'autre',
      categoryId: 3,
      openSearch: false,
    });
  });

  it('ce qui est affiché passe avant la base', () => {
    const plan = planItemTarget(valide(), {
      ...rien,
      shown: [{ caseKey: 'film', itemId: ITEM }],
      placements: [{ bentoId: 'autre', categoryId: 3, itemId: ITEM }],
    });
    assert.equal(plan?.where, 'shown');
  });

  it('l’item remplacé entre-temps : nulle part où aller', () => {
    assert.equal(planItemTarget(valide(), rien), null);
  });

  it('un refus déjà retiré du brouillon : la recherche de sa case d’origine (D25)', () => {
    assert.deepEqual(planItemTarget(valide({ status: 'rejected' }), { ...rien, originCaseKey: 'film' }), {
      where: 'shown',
      caseKey: 'film',
      openSearch: true,
    });
  });

  it('la case d’origine ne sert qu’à un refus', () => {
    assert.equal(planItemTarget(valide(), { ...rien, originCaseKey: 'film' }), null);
  });
});

describe('notificationSection', () => {
  const sans = { items: false, editions: false };
  const reglages = { transactional: true, editorial: false };

  it('jamais demandée : on propose d’activer', () => {
    assert.deepEqual(
      notificationSection({ permission: { granted: false, canAskAgain: true }, device: null, channels: sans }),
      { state: 'ask' },
    );
  });

  it('refusée pour de bon : on renvoie aux réglages du téléphone', () => {
    assert.deepEqual(
      notificationSection({ permission: { granted: false, canAskAgain: false }, device: reglages, channels: sans }),
      { state: 'blocked' },
    );
  });

  it('accordée sans appareil enregistré : indisponible, pas deux interrupteurs inertes', () => {
    assert.deepEqual(
      notificationSection({ permission: { granted: true, canAskAgain: true }, device: null, channels: sans }),
      { state: 'unavailable' },
    );
  });

  it('accordée : les deux interrupteurs, et le canal qu’Android a coupé', () => {
    assert.deepEqual(
      notificationSection({
        permission: { granted: true, canAskAgain: false },
        device: reglages,
        channels: { items: false, editions: true },
      }),
      {
        state: 'ready',
        items: { on: true, blockedBySystem: false },
        editions: { on: false, blockedBySystem: true },
      },
    );
  });
});

describe('shouldOfferEditorialAsk', () => {
  const peutDemander = { granted: false, canAskAgain: true };

  it('la première fois, autorisation accordée ou encore demandable', () => {
    assert.equal(
      shouldOfferEditorialAsk({ permission: { granted: true, canAskAgain: false }, editorialOn: false, alreadyAnswered: false }),
      true,
    );
    assert.equal(shouldOfferEditorialAsk({ permission: peutDemander, editorialOn: false, alreadyAnswered: false }), true);
  });

  it('jamais deux fois : après un oui comme après un non, le profil décide', () => {
    assert.equal(shouldOfferEditorialAsk({ permission: peutDemander, editorialOn: false, alreadyAnswered: true }), false);
  });

  it('pas quand les éditions sont déjà allumées', () => {
    assert.equal(
      shouldOfferEditorialAsk({ permission: { granted: true, canAskAgain: true }, editorialOn: true, alreadyAnswered: false }),
      false,
    );
  });

  it('pas quand le système ne peut plus demander : le oui n’ouvrirait rien', () => {
    assert.equal(
      shouldOfferEditorialAsk({ permission: { granted: false, canAskAgain: false }, editorialOn: false, alreadyAnswered: false }),
      false,
    );
  });
});
