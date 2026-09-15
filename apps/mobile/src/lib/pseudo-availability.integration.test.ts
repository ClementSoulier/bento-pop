import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { isPseudoTaken, type PseudoClient } from './pseudo-availability';
import {
  STUB_CLIENT_OPTIONS,
  startPostgrestStub,
  type PostgrestStub,
} from '../test/postgrest-stub';
import type { Database } from '@/supabase/types';

/**
 * Disponibilité d'un pseudo à l'inscription, contre un bouchon PostgREST.
 * C'est la forme de la requête qui compte : un joker non échappé ne casse
 * rien de visible jusqu'au jour où six voisins répondent au même motif.
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

describe('isPseudoTaken', () => {
  it('interroge `users` avec le joker `_` échappé, antislash encodé sur le fil', async () => {
    stub.enqueue([]);
    await isPseudoTaken(client, ' dark_hifus ');

    const [req] = stub.requests;
    assert.ok(req, 'aucune requête reçue');
    assert.equal(req.method, 'GET');
    assert.equal(req.path, '/rest/v1/users');
    const params = new URLSearchParams(req.rawQuery);
    assert.equal(params.get('select'), 'pseudo');
    assert.equal(params.get('pseudo'), 'ilike.dark\\_hifus');
    assert.ok(req.rawQuery.includes('dark%5C_hifus'), req.rawQuery);
    assert.equal(params.get('limit'), '5');
  });

  it('dit « pris » quand un compte porte ce pseudo, à la casse près', async () => {
    stub.enqueue([{ pseudo: 'Dark_Hifus' }]);
    assert.equal(await isPseudoTaken(client, 'dark_hifus'), true);
  });

  it('dit « libre » quand aucun compte ne le porte', async () => {
    stub.enqueue([]);
    assert.equal(await isPseudoTaken(client, 'dark_hifus'), false);
  });

  /** Seconde ligne de défense si l'échappement venait à sauter. */
  it('ne compte pas un voisin que le joker aurait remonté', async () => {
    stub.enqueue([{ pseudo: 'buyt.k' }, { pseudo: 'buytak' }]);
    assert.equal(await isPseudoTaken(client, 'buyt_k'), false);
  });

  /** « On ne sait pas » ne doit se lire ni « pris » ni « libre ». */
  it('lève en cas d’erreur au lieu de trancher', async () => {
    stub.enqueue({ message: 'boom', code: '500', details: null, hint: null }, 500);
    await assert.rejects(() => isPseudoTaken(client, 'dark_hifus'), /Pseudo check failed/);
  });
});
