import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AbortTimeoutError, withAbortTimeout } from './abort-timeout';

/** Une opération qui ne répond jamais, mais qui entend l'annulation. */
function hanging(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(new Error('AbortError')));
  });
}

describe('withAbortTimeout', () => {
  it('rend la valeur de l’opération quand elle répond à temps', async () => {
    assert.equal(await withAbortTimeout(async () => 42, 1000), 42);
  });

  it('propage l’erreur de l’opération telle quelle', async () => {
    await assert.rejects(
      () => withAbortTimeout(async () => Promise.reject(new Error('boom')), 1000),
      /boom/,
    );
  });

  /**
   * Le cas du réseau qui accepte la connexion sans répondre : sans délai,
   * l'écran resterait sur son squelette aussi longtemps que le système
   * laisse la requête en vie.
   */
  it('abandonne à l’échéance, annule l’opération et lève une erreur de statut 0', async () => {
    let seen: AbortSignal | undefined;
    const started = Date.now();
    await assert.rejects(
      () =>
        withAbortTimeout((signal) => {
          seen = signal;
          return hanging(signal);
        }, 40),
      (error: unknown) => {
        assert.ok(error instanceof AbortTimeoutError);
        assert.equal(error.status, 0);
        return true;
      },
    );
    assert.equal(seen?.aborted, true, 'l’opération doit être annulée, pas abandonnée à son sort');
    assert.ok(Date.now() - started < 400, `trop long : ${Date.now() - started} ms`);
  });

  it('tient l’échéance même si l’opération ignore le signal', async () => {
    const deaf = () => new Promise<never>(() => {});
    await assert.rejects(() => withAbortTimeout(deaf, 30), AbortTimeoutError);
  });

  it('relaie l’annulation du parent', async () => {
    const parent = new AbortController();
    const pending = withAbortTimeout(hanging, 10_000, parent.signal);
    parent.abort();
    await assert.rejects(() => pending, /AbortError/);
  });

  it('part annulée si le parent l’est déjà', async () => {
    const parent = new AbortController();
    parent.abort();
    let aborted = false;
    await withAbortTimeout(
      async (signal) => {
        aborted = signal.aborted;
      },
      1000,
      parent.signal,
    );
    assert.equal(aborted, true);
  });

  /**
   * Un minuteur oublié garderait le processus en vie, et sur l'appareil
   * rappellerait `abort` sur une requête déjà terminée.
   */
  it('ne laisse aucun minuteur derrière une réponse à temps', async () => {
    const before = process.getActiveResourcesInfo().filter((r) => r === 'Timeout').length;
    await withAbortTimeout(async () => 'ok', 60_000);
    const after = process.getActiveResourcesInfo().filter((r) => r === 'Timeout').length;
    assert.equal(after, before);
  });
});
