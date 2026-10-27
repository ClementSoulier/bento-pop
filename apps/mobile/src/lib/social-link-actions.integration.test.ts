import assert from 'node:assert/strict';
import { after, afterEach, before, describe, it } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { STUB_CLIENT_OPTIONS, startPostgrestStub, type PostgrestStub } from '../test/postgrest-stub';
import {
  fetchSocialLinks,
  setSocialLinks,
  socialLinksKey,
  writeSocialVisible,
  type SocialClient,
} from './social-link-actions';
import { socialErrorFor } from './social-links';
import type { Database } from '@/supabase/types';

/**
 * Les appels du chantier 25, avec un vrai `supabase-js` contre le bouchon
 * PostgREST : le nom de chaque fonction, ses arguments, et ce que l'app garde
 * de la réponse. Les règles elles-mêmes se contrôlent contre un Supabase
 * local, `scripts/check-social-links.mjs`.
 */

const USER = '3f2b8c1e-5d4a-4b6f-9e0d-1a2b3c4d5e6f';

let stub: PostgrestStub;
let client: SocialClient;

before(async () => {
  stub = await startPostgrestStub();
  client = createClient<Database>(stub.url, 'cle-anon-de-test', STUB_CLIENT_OPTIONS);
});

afterEach(() => {
  stub.requests.length = 0;
});

after(() => stub.close());

const body = (i = 0) => JSON.parse(stub.requests[i]?.body ?? '{}');

describe('écrire ses liens', () => {
  it('envoie les deux pseudos, rend ce que la base a gardé', async () => {
    stub.enqueue([{ instagram: 'lea_cine', tiktok: 'lea.cine' }]);
    assert.deepEqual(await setSocialLinks(client, 'lea_cine', 'lea.cine'), { instagram: 'lea_cine', tiktok: 'lea.cine' });
    assert.equal(stub.requests[0]?.path, '/rest/v1/rpc/set_social_links');
    assert.deepEqual(body(), { p_instagram: 'lea_cine', p_tiktok: 'lea.cine' });
  });

  it('délier : la base ne rend rien, l\'app non plus', async () => {
    stub.enqueue([]);
    assert.deepEqual(await setSocialLinks(client, null, null), { instagram: null, tiktok: null });
    assert.deepEqual(body(), { p_instagram: null, p_tiktok: null });
  });

  it('un refus remonte sa clé, que l\'app traduit sous son champ', async () => {
    stub.enqueue({ message: 'social_filtered_tiktok', code: '22023' }, 400);
    await assert.rejects(setSocialLinks(client, null, 'x'), (e: unknown) => {
      assert.deepEqual(socialErrorFor(e), { network: 'tiktok', message: "Ce pseudo n'est pas accepté." });
      return true;
    });
  });
});

describe('lire les liens d\'un compte', () => {
  it('appelle social_links avec le compte', async () => {
    stub.enqueue([{ instagram: 'lea_cine', tiktok: null, visible: true }]);
    assert.deepEqual(await fetchSocialLinks(client, USER), { instagram: 'lea_cine', tiktok: null, visible: true });
    assert.equal(stub.requests[0]?.path, '/rest/v1/rpc/social_links');
    assert.deepEqual(body(), { p_user: USER });
  });

  it('aucune ligne : aucun lien', async () => {
    stub.enqueue([]);
    assert.equal(await fetchSocialLinks(client, USER), null);
  });
});

describe('afficher ses réseaux', () => {
  it('écrit la seule colonne du réglage, sur sa ligne', async () => {
    stub.enqueue([]);
    await writeSocialVisible(client, USER, false);
    assert.equal(stub.requests[0]?.method, 'PATCH');
    assert.equal(stub.requests[0]?.path, '/rest/v1/users');
    assert.equal(stub.requests[0]?.query, `id=eq.${USER}`);
    assert.deepEqual(body(), { social_visible: false });
  });
});

describe('les clés', () => {
  it('les liens dépendent de qui les lit', () => {
    assert.notDeepEqual(socialLinksKey(USER, 'a'), socialLinksKey(USER, 'b'));
  });
});
