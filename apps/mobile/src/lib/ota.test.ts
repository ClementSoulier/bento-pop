import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runStartupUpdate, type OtaDeps, type OtaPhase } from './ota';

const FAST = { check: 40, fetch: 40 };

/** Construit un jeu de dépendances traçable, tout en succès par défaut. */
function spy(over: Partial<OtaDeps> = {}) {
  const calls = { check: 0, fetch: 0, reload: 0 };
  const phases: OtaPhase[] = [];
  const base: OtaDeps = {
    enabled: true,
    check: async () => ({ isAvailable: true }),
    fetchUpdate: async () => ({ isNew: true }),
    reload: async () => {},
    onPhase: (p) => phases.push(p),
    ...over,
  };
  // Le comptage enveloppe la surcharge : un test qui remplace `check` voit
  // quand même son appel compté.
  const deps: OtaDeps = {
    ...base,
    check: () => {
      calls.check++;
      return base.check();
    },
    fetchUpdate: () => {
      calls.fetch++;
      return base.fetchUpdate();
    },
    reload: () => {
      calls.reload++;
      return base.reload();
    },
  };
  return { deps, calls, phases };
}

const never = <T,>(): Promise<T> => new Promise<T>(() => {});

test('1. désactivé : rien n’est appelé, rien n’est affiché', async () => {
  const { deps, calls, phases } = spy({ enabled: false });
  assert.equal(await runStartupUpdate(deps, FAST), 'skipped');
  assert.deepEqual(calls, { check: 0, fetch: 0, reload: 0 });
  assert.deepEqual(phases, [], 'pas de phase → pas d’écran de mise à jour en dev');
});

test('2. pas de mise à jour : aucun écran de téléchargement', async () => {
  const { deps, calls, phases } = spy({ check: async () => ({ isAvailable: false }) });
  assert.equal(await runStartupUpdate(deps, FAST), 'none');
  assert.equal(calls.fetch, 0);
  assert.equal(calls.reload, 0);
  assert.deepEqual(phases, ['checking'], 'jamais « downloading » sans mise à jour');
});

test('3. vérification qui dépasse son plafond : on laisse démarrer', async () => {
  const { deps, calls, phases } = spy({ check: () => never() });
  assert.equal(await runStartupUpdate(deps, FAST), 'timeout');
  assert.equal(calls.fetch, 0, 'ne pas télécharger ce qu’on n’a pas vérifié');
  assert.equal(calls.reload, 0);
  assert.deepEqual(phases, ['checking']);
});

test('4. vérification qui lève : on laisse démarrer', async () => {
  const { deps, calls } = spy({
    check: async () => {
      throw new Error('réseau');
    },
  });
  assert.equal(await runStartupUpdate(deps, FAST), 'failed');
  assert.equal(calls.fetch, 0);
  assert.equal(calls.reload, 0);
});

test('5. téléchargement qui dépasse son plafond : PAS de rechargement', async () => {
  const { deps, calls, phases } = spy({ fetchUpdate: () => never() });
  assert.equal(await runStartupUpdate(deps, FAST), 'timeout');
  assert.equal(
    calls.reload,
    0,
    'recharger sur un bundle incomplet = app morte sans recours',
  );
  assert.deepEqual(phases, ['checking', 'downloading']);
});

test('6. téléchargement qui lève : PAS de rechargement', async () => {
  const { deps, calls } = spy({
    fetchUpdate: async () => {
      throw new Error('coupure');
    },
  });
  assert.equal(await runStartupUpdate(deps, FAST), 'failed');
  assert.equal(calls.reload, 0);
});

test('7. rien de neuf après téléchargement : pas de rechargement', async () => {
  const { deps, calls } = spy({ fetchUpdate: async () => ({ isNew: false }) });
  assert.equal(await runStartupUpdate(deps, FAST), 'none');
  assert.equal(calls.reload, 0);
});

test('8. chemin nominal : un seul rechargement', async () => {
  const { deps, calls, phases } = spy();
  assert.equal(await runStartupUpdate(deps, FAST), 'reloading');
  assert.deepEqual(calls, { check: 1, fetch: 1, reload: 1 });
  assert.deepEqual(phases, ['checking', 'downloading']);
});

test('9. rechargement qui lève : la fonction rend la main sans lever', async () => {
  const { deps } = spy({
    reload: async () => {
      throw new Error('reloadAsync refusé');
    },
  });
  assert.equal(await runStartupUpdate(deps, FAST), 'failed');
});

test('10. une réponse malformée ne fait pas recharger', async () => {
  // `checkForUpdateAsync` est du natif : on ne suppose pas la forme du retour.
  const { deps, calls } = spy({
    check: async () => undefined as unknown as { isAvailable: boolean },
  });
  assert.equal(await runStartupUpdate(deps, FAST), 'none');
  assert.equal(calls.reload, 0);
});

test('11. un retard n’annule pas la promesse, il cesse de l’attendre', async () => {
  // Ce qui reste en vol continue : c’est ce qui garantit que la mise à jour
  // ratée aujourd’hui s’applique au prochain démarrage à froid.
  let resolved = false;
  const { deps } = spy({
    check: () =>
      new Promise((r) =>
        setTimeout(() => {
          resolved = true;
          r({ isAvailable: false });
        }, 80),
      ),
  });
  assert.equal(await runStartupUpdate(deps, { check: 20, fetch: 20 }), 'timeout');
  assert.equal(resolved, false, 'pas encore, mais toujours en vol');
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(resolved, true);
});
