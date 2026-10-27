import assert from 'node:assert/strict';
import { after, afterEach, before, describe, it } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { STUB_CLIENT_OPTIONS, startPostgrestStub, type PostgrestStub } from '../test/postgrest-stub';
import { PAGE_SIZE, loadFollowingPage } from './feed';
import {
  answerFollow,
  fetchFollowList,
  fetchFollowSummary,
  removeFollower,
  setFollow,
  writeFollowApproval,
  type FollowClient,
} from './follow-actions';
import { FOLLOW_PAGE, followErrorMessage } from './follows';
import type { Database } from '@/supabase/types';

/**
 * Les appels du chantier 23, avec un vrai `supabase-js` contre le bouchon
 * PostgREST : le nom de chaque fonction, ses arguments, et ce que l'app garde
 * de la réponse. Les règles elles-mêmes se contrôlent contre un Supabase
 * local, `scripts/check-follows.mjs`.
 */

const USER = '3f2b8c1e-5d4a-4b6f-9e0d-1a2b3c4d5e6f';
const OTHER = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

let stub: PostgrestStub;
let client: FollowClient;

before(async () => {
  stub = await startPostgrestStub();
  client = createClient<Database>(stub.url, 'cle-anon-de-test', STUB_CLIENT_OPTIONS);
});

afterEach(() => {
  stub.requests.length = 0;
});

after(() => stub.close());

const body = (i = 0) => JSON.parse(stub.requests[i]?.body ?? '{}');

describe('suivre', () => {
  it('envoie le compte et le geste, rend l’état gardé', async () => {
    stub.enqueue('pending');
    assert.equal(await setFollow(client, USER, true), 'pending');
    assert.equal(stub.requests[0]?.path, '/rest/v1/rpc/set_follow');
    assert.deepEqual(body(), { p_user: USER, p_on: true });
  });

  it('ne plus suivre : la base ne rend rien, l’app non plus', async () => {
    stub.enqueue(null);
    assert.equal(await setFollow(client, USER, false), null);
    assert.equal(body().p_on, false);
  });

  it('un refus remonte sa clé, que l’app traduit', async () => {
    stub.enqueue({ message: 'follow_blocked', code: '42501' }, 403);
    await assert.rejects(setFollow(client, USER, true), (e: unknown) => {
      assert.equal(followErrorMessage(e), 'Tu ne peux pas suivre ce compte.');
      return true;
    });
  });
});

describe('répondre et retirer', () => {
  it('accepter une demande', async () => {
    stub.enqueue(true);
    assert.equal(await answerFollow(client, OTHER, true), true);
    assert.equal(stub.requests[0]?.path, '/rest/v1/rpc/answer_follow');
    assert.deepEqual(body(), { p_follower: OTHER, p_accept: true });
  });

  it('retirer un abonné', async () => {
    stub.enqueue(false);
    assert.equal(await removeFollower(client, OTHER), false);
    assert.equal(stub.requests[0]?.path, '/rest/v1/rpc/remove_follower');
    assert.deepEqual(body(), { p_follower: OTHER });
  });
});

describe('« Valider mes abonnés » (D3)', () => {
  it('écrit la colonne de sa propre ligne', async () => {
    stub.enqueue([]);
    await writeFollowApproval(client, USER, true);
    const req = stub.requests[0];
    assert.equal(req?.method, 'PATCH');
    assert.equal(req?.path, '/rest/v1/users');
    assert.match(req?.query ?? '', new RegExp(`id=eq\\.${USER}`));
    assert.deepEqual(body(), { follow_approval: true });
  });
});

describe('les nombres', () => {
  it('par follow_summary, en noms de l’app', async () => {
    stub.enqueue([{ followers: 4, following: 2, requests: 1, my_status: null, approval: true }]);
    assert.deepEqual(await fetchFollowSummary(client, USER), {
      followers: 4,
      following: 2,
      requests: 1,
      myStatus: null,
      approval: true,
    });
    assert.equal(stub.requests[0]?.path, '/rest/v1/rpc/follow_summary');
    assert.deepEqual(body(), { p_user: USER });
  });

  it('rien quand l’interrupteur est éteint', async () => {
    stub.enqueue([]);
    assert.equal(await fetchFollowSummary(client, USER), null);
  });
});

describe('les listes', () => {
  it('la première page, sans curseur', async () => {
    stub.enqueue([]);
    assert.deepEqual(await fetchFollowList(client, USER, 'followers'), []);
    assert.equal(stub.requests[0]?.path, '/rest/v1/rpc/follow_list');
    assert.deepEqual(body(), {
      p_user: USER,
      p_kind: 'followers',
      p_before: null,
      p_before_id: null,
      p_limit: FOLLOW_PAGE,
    });
  });

  it('la suivante, après la dernière ligne lue', async () => {
    stub.enqueue([]);
    await fetchFollowList(client, USER, 'requests', { before: '2026-10-27T06:40:17.022+00:00', beforeId: OTHER });
    assert.equal(body().p_before, '2026-10-27T06:40:17.022+00:00');
    assert.equal(body().p_before_id, OTHER);
    assert.equal(body().p_kind, 'requests');
  });
});

describe('le fil des abonnements (D1, D7)', () => {
  it('appelle following_bentos avec la sélection, l’ordre et la page de « La table »', async () => {
    stub.enqueue([]);
    const page = await loadFollowingPage(client, null);
    assert.deepEqual(page, { bentos: [], nextCursor: null });
    const req = stub.requests[0];
    assert.equal(req?.path, '/rest/v1/rpc/following_bentos');
    assert.match(req?.query ?? '', /select=.*users:user_id\(pseudo,display_name,kind,avatar\)/);
    assert.match(req?.query ?? '', /order=published_at\.desc,id\.desc/);
    assert.match(req?.query ?? '', new RegExp(`limit=${PAGE_SIZE}`));
    assert.ok(!(req?.query ?? '').includes('or='), req?.query);
  });

  it('le curseur, son « + » encodé', async () => {
    stub.enqueue([]);
    await loadFollowingPage(client, { publishedAt: '2026-08-26T22:10:09.227+00:00', id: 'b-9' });
    const req = stub.requests[0];
    assert.match(req?.query ?? '', /or=\(published_at\.lt\.2026-08-26T22:10:09\.227\+00:00,/);
    assert.match(req?.rawQuery ?? '', /%2B00%3A00/);
  });

  it('une panne se lève, au lieu d’un fil vide', async () => {
    stub.enqueue({ message: 'boom' }, 500);
    await assert.rejects(loadFollowingPage(client, null), /Feed load failed: boom/);
  });
});
