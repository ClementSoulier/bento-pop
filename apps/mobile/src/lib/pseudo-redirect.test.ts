import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { redirectPath, resolveOldPseudo, type RedirectClient } from './pseudo-redirect';
import { STUB_CLIENT_OPTIONS, startPostgrestStub, type PostgrestStub } from '../test/postgrest-stub';
import type { Database } from '@/supabase/types';

/** Les anciens liens, chantier 21 (D6) : où mène un ancien pseudo. */

describe('redirectPath', () => {
  it('mène au compte, ou au bento nommé sous le nouveau pseudo', () => {
    assert.equal(redirectPath('nouveau', null), '/u/nouveau');
    assert.equal(redirectPath('nouveau', 'semaine-42'), '/u/nouveau/semaine-42');
  });
});

let stub: PostgrestStub;
let client: RedirectClient;

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

describe('resolveOldPseudo', () => {
  it('appelle `resolve_pseudo` avec le pseudo débarrassé de ses blancs', async () => {
    stub.enqueue('nouveau');
    assert.equal(await resolveOldPseudo(client, ' ancien '), 'nouveau');
    assert.equal(stub.requests[0]!.path, '/rest/v1/rpc/resolve_pseudo');
    assert.deepEqual(JSON.parse(stub.requests[0]!.body), { p_pseudo: 'ancien' });
  });

  it('ne mène nulle part pour un pseudo qu’aucun compte n’a porté', async () => {
    stub.enqueue(null);
    assert.equal(await resolveOldPseudo(client, 'inconnu'), null);
    stub.enqueue('  ');
    assert.equal(await resolveOldPseudo(client, 'inconnu'), null);
  });

  /** « On ne sait pas » ne doit pas se lire « introuvable » pour toujours. */
  it('lève en cas d’erreur', async () => {
    stub.enqueue({ message: 'boom', code: '500', details: null, hint: null }, 500);
    await assert.rejects(() => resolveOldPseudo(client, 'ancien'), /Pseudo resolution failed/);
  });
});
