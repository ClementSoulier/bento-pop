import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { describeApp, recordVisit, type TelemetryClient } from './telemetry';
import { STUB_CLIENT_OPTIONS, startPostgrestStub, type PostgrestStub } from '../test/postgrest-stub';
import type { Database } from '@/supabase/types';

/**
 * Ce que le bouchon permet de vérifier et que les tests purs ne voient pas :
 * la requête réellement envoyée, et surtout que **rien ne remonte jamais**.
 */

let stub: PostgrestStub;
let client: TelemetryClient;

before(async () => {
  stub = await startPostgrestStub();
  client = createClient<Database>(stub.url, 'stub-anon-key', STUB_CLIENT_OPTIONS);
});
after(async () => {
  await stub.close();
});

const reset = () => {
  stub.requests.length = 0;
};

const FIXED = () => new Date('2026-09-12T18:00:00.000Z');

describe('recordVisit', () => {
  it('met à jour la seule ligne de la personne', async () => {
    reset();
    stub.enqueue([]);
    await recordVisit(client, 'user-1', describeApp('ios', '0.1.0'), FIXED);

    const req = stub.requests.at(-1);
    assert.ok(req);
    assert.equal(req.method, 'PATCH');
    assert.equal(req.path, '/rest/v1/users');
    // Le filtre est ce qui empêche d'écraser tout le monde : une mise à jour
    // sans `where` sur PostgREST touche toutes les lignes visibles.
    assert.match(req.query, /id=eq\.user-1/);
  });

  it('envoie les trois colonnes, et rien d\'autre', async () => {
    reset();
    stub.enqueue([]);
    await recordVisit(client, 'user-1', describeApp('android', '2.0.0'), FIXED);

    const body = JSON.parse(stub.requests.at(-1)!.body) as Record<string, unknown>;
    assert.deepEqual(body, {
      last_seen_at: '2026-09-12T18:00:00.000Z',
      platform: 'android',
      app_version: '2.0.0',
    });
  });

  it('envoie null plutôt que d\'omettre une valeur inconnue', async () => {
    reset();
    stub.enqueue([]);
    await recordVisit(client, 'user-1', describeApp('web', null), FIXED);

    const body = JSON.parse(stub.requests.at(-1)!.body) as Record<string, unknown>;
    // Omettre la clé laisserait l'ancienne valeur en base : quelqu'un passé
    // du téléphone au web garderait « ios » pour toujours.
    assert.equal(body.platform, null);
    assert.equal(body.app_version, null);
    assert.ok('platform' in body && 'app_version' in body);
  });

  /**
   * Le comportement qui compte le plus. Cette écriture part depuis
   * `session.init()`, au démarrage. Si elle levait, l'app resterait sur le
   * splash pour une colonne d'écran d'administration.
   */
  it('ne lève jamais, quelle que soit la réponse', async () => {
    for (const [label, body, status] of [
      ['refus RLS', { message: 'permission denied', code: '42501' }, 403],
      ['contrainte', { message: 'violates check constraint "users_platform_check"' }, 400],
      ['panne serveur', { message: 'boom' }, 500],
    ] as const) {
      reset();
      stub.enqueue(body, status);
      const ok = await recordVisit(client, 'user-1', describeApp('ios', '1.0.0'), FIXED);
      assert.equal(ok, false, `${label} devrait être signalé comme échoué`);
    }
  });

  it('ne lève pas non plus quand le réseau est injoignable', async () => {
    const dead = createClient<Database>('http://127.0.0.1:1', 'k', STUB_CLIENT_OPTIONS);
    const ok = await recordVisit(dead, 'user-1', describeApp('ios', '1.0.0'), FIXED);
    assert.equal(ok, false);
  });

  it('rend true quand tout se passe bien', async () => {
    reset();
    stub.enqueue([]);
    assert.equal(await recordVisit(client, 'user-1', describeApp('ios', '1.0.0'), FIXED), true);
  });
});
