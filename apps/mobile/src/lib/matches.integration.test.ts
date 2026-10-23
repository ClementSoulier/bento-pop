import assert from 'node:assert/strict';
import { after, afterEach, before, describe, it } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import {
  STUB_CLIENT_OPTIONS,
  startPostgrestStub,
  type PostgrestStub,
} from '../test/postgrest-stub';
import { bentoMatchesQueryOptions, loadMatches, type MatchesClient } from './matches';
import { writeSearchable } from './search';
import type { Database } from '@/supabase/types';

/**
 * Les mêmes goûts et le réglage de recherche, chantier 20, avec un vrai
 * `supabase-js` contre le bouchon PostgREST.
 */

const BENTO = '3f2b8c1e-5d4a-4b6f-9e0d-1a2b3c4d5e6f';
const USER = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

let stub: PostgrestStub;
let client: MatchesClient;

before(async () => {
  stub = await startPostgrestStub();
  client = createClient<Database>(stub.url, 'cle-anon-de-test', STUB_CLIENT_OPTIONS);
});

afterEach(() => {
  stub.requests.length = 0;
});

after(() => stub.close());

describe('loadMatches', () => {
  it('demande les matchs du bento, vingt au plus, et rend les lignes valides', async () => {
    stub.enqueue([
      {
        bento_id: 'b1',
        slug: 'mon-bento',
        is_primary: true,
        pseudo: 'alice',
        display_name: null,
        edition_title: null,
        shared: 1,
        score: 0.5,
        items: [{ id: 'i1', title: 'Dune', category_id: 1 }],
      },
      { bento_id: 'b2', slug: 'vide', is_primary: true, pseudo: 'bob', items: [] },
    ]);
    const matches = await loadMatches(client, BENTO);
    assert.deepEqual(
      matches.map((m) => m.pseudo),
      ['alice'],
    );
    const [request] = stub.requests;
    assert.equal(request?.method, 'POST');
    assert.equal(request?.path, '/rest/v1/rpc/bento_matches');
    assert.deepEqual(JSON.parse(request?.body ?? '{}'), { p_bento: BENTO, lim: 20 });
  });

  it('rend une liste vide pour un bento sans match', async () => {
    stub.enqueue([]);
    assert.deepEqual(await loadMatches(client, BENTO), []);
  });

  it('lève sur une panne : l’écran ne la confond pas avec un bento sans match', async () => {
    stub.enqueue({ message: 'boom' }, 500);
    await assert.rejects(loadMatches(client, BENTO), /Matches load failed/);
  });

  it('partage sa clé entre la pastille et l’écran, et ne réessaie pas', async () => {
    const options = bentoMatchesQueryOptions(client, BENTO);
    assert.equal(options.retry, false);
    assert.deepEqual(options.queryKey, ['bento-matches', BENTO]);
    assert.equal(options.staleTime, 5 * 60 * 1000);
    stub.enqueue([]);
    assert.deepEqual(await options.queryFn({ signal: new AbortController().signal }), []);
  });
});

describe('writeSearchable', () => {
  it('écrit le réglage sur sa propre ligne, et rien d’autre', async () => {
    stub.enqueue(null, 204);
    await writeSearchable(client, USER, false);
    const [request] = stub.requests;
    assert.equal(request?.method, 'PATCH');
    assert.equal(request?.path, '/rest/v1/users');
    assert.equal(request?.query, `id=eq.${USER}`);
    assert.deepEqual(JSON.parse(request?.body ?? '{}'), { searchable: false });
  });

  it('lève si la base refuse', async () => {
    stub.enqueue({ message: 'permission denied' }, 403);
    await assert.rejects(writeSearchable(client, USER, true));
  });
});
