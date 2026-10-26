import assert from 'node:assert/strict';
import { after, afterEach, before, describe, it } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { STUB_CLIENT_OPTIONS, startPostgrestStub, type PostgrestStub } from '../test/postgrest-stub';
import { fetchOwnWhys, setWhy, type WhyClient } from './why-actions';
import { whyErrorMessage } from './whys';
import type { Database } from '@/supabase/types';

/**
 * Les appels du chantier 12, avec un vrai `supabase-js` contre le bouchon
 * PostgREST : le nom de chaque fonction, ses arguments, et ce que l'app garde
 * de la réponse. Les règles elles-mêmes se contrôlent contre un Supabase
 * local, `scripts/check-whys.mjs`.
 */

const BENTO = '3f2b8c1e-5d4a-4b6f-9e0d-1a2b3c4d5e6f';

let stub: PostgrestStub;
let client: WhyClient;

before(async () => {
  stub = await startPostgrestStub();
  client = createClient<Database>(stub.url, 'cle-anon-de-test', STUB_CLIENT_OPTIONS);
});

afterEach(() => {
  stub.requests.length = 0;
});

after(() => stub.close());

const body = (i = 0) => JSON.parse(stub.requests[i]?.body ?? '{}');

describe('écrire un pourquoi', () => {
  it('envoie la clé de la case et le texte nettoyé, rend la ligne gardée', async () => {
    stub.enqueue([
      { case_key: 'film', body: 'Le premier film.', status: 'visible', hidden_reason: null, updated_at: '2026-10-26T12:00:00Z' },
    ]);
    const row = await setWhy(client, BENTO, 'film', '  Le premier\n film.  ');
    assert.equal(stub.requests[0]?.path, '/rest/v1/rpc/set_bento_why');
    assert.deepEqual(body(), { p_bento: BENTO, p_case: 'film', p_body: 'Le premier film.' });
    assert.equal(row?.body, 'Le premier film.');
  });

  it('vide, il efface : la base ne rend rien, l\'app non plus', async () => {
    stub.enqueue([]);
    assert.equal(await setWhy(client, BENTO, 'film', '   '), null);
    assert.equal(body().p_body, '');
  });

  it('un refus du filtre remonte sa clé, que l\'app traduit', async () => {
    stub.enqueue({ message: 'why_refused_filter', code: '23514' }, 400);
    await assert.rejects(setWhy(client, BENTO, 'film', 'quel c0nnard'), (e: unknown) => {
      assert.equal(whyErrorMessage(e), 'Ce pourquoi contient un mot ou un lien refusé.');
      return true;
    });
  });
});

describe('lire les siens', () => {
  it('par my_bento_whys, masqués compris', async () => {
    stub.enqueue([
      { case_key: 'film', body: 'Le premier.', status: 'visible', hidden_reason: null, updated_at: '' },
      { case_key: 'track', body: 'Masqué.', status: 'hidden', hidden_reason: 'Spam ou arnaque', updated_at: '' },
    ]);
    const rows = await fetchOwnWhys(client, BENTO);
    assert.equal(stub.requests[0]?.path, '/rest/v1/rpc/my_bento_whys');
    assert.deepEqual(body(), { p_bento: BENTO });
    assert.deepEqual(
      rows.map((r) => [r.case_key, r.status, r.hidden_reason]),
      [
        ['film', 'visible', null],
        ['track', 'hidden', 'Spam ou arnaque'],
      ],
    );
  });
});
