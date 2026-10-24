import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { pseudoStatus, type PseudoClient } from './pseudo-availability';
import {
  STUB_CLIENT_OPTIONS,
  startPostgrestStub,
  type PostgrestStub,
} from '../test/postgrest-stub';
import type { Database } from '@/supabase/types';

/**
 * Ce que la base dit d'un pseudo, contre un bouchon PostgREST. C'est la forme
 * de l'appel qui compte, et la façon de lire une réponse qu'on ne connaît pas.
 */

let stub: PostgrestStub;
let client: PseudoClient;

before(async () => {
  stub = await startPostgrestStub();
  client = createClient<Database>(stub.url, 'stub-anon-key', STUB_CLIENT_OPTIONS);
});

after(async () => {
  await stub.close();
});

beforeEach(() => {
  stub.requests.length = 0;
});

describe('pseudoStatus', () => {
  it('appelle `pseudo_status` avec le pseudo débarrassé de ses blancs', async () => {
    stub.enqueue('available');
    await pseudoStatus(client, ' dark_hifus ');

    const [req] = stub.requests;
    assert.ok(req, 'aucune requête reçue');
    assert.equal(req.method, 'POST');
    assert.equal(req.path, '/rest/v1/rpc/pseudo_status');
    assert.deepEqual(JSON.parse(req.body), { p_pseudo: 'dark_hifus' });
  });

  it('rend ce que dit la base, ancien pseudo réservé compris', async () => {
    for (const status of ['available', 'taken', 'reserved', 'forbidden', 'current', 'invalid'] as const) {
      stub.enqueue(status);
      assert.equal(await pseudoStatus(client, 'dark_hifus'), status);
    }
  });

  /** Une réponse inconnue ne doit se lire ni « pris » ni « libre ». */
  it('lève sur une réponse inconnue', async () => {
    stub.enqueue('peut-être');
    await assert.rejects(() => pseudoStatus(client, 'dark_hifus'), /Pseudo check failed/);
  });

  /** « On ne sait pas » ne doit se lire ni « pris » ni « libre ». */
  it('lève en cas d’erreur au lieu de trancher', async () => {
    stub.enqueue({ message: 'boom', code: '500', details: null, hint: null }, 500);
    await assert.rejects(() => pseudoStatus(client, 'dark_hifus'), /Pseudo check failed/);
  });
});
