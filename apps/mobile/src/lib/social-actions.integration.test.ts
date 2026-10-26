import assert from 'node:assert/strict';
import { after, afterEach, before, describe, it } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { STUB_CLIENT_OPTIONS, startPostgrestStub, type PostgrestStub } from '../test/postgrest-stub';
import {
  SOCIAL_BATCH,
  deleteComment,
  fetchBentoSocial,
  fetchComments,
  postComment,
  setLike,
  submitReport,
  syncBlocks,
  type SocialClient,
} from './social-actions';
import { socialErrorMessage } from './social';
import type { Database } from '@/supabase/types';

/**
 * Les appels du chantier 22, avec un vrai `supabase-js` contre le bouchon
 * PostgREST : le nom de chaque fonction, ses arguments, et ce que l'app
 * garde de la réponse. Les règles elles-mêmes se contrôlent contre un
 * Supabase local, `scripts/check-social.mjs`.
 */

const BENTO = '3f2b8c1e-5d4a-4b6f-9e0d-1a2b3c4d5e6f';

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

describe('les nombres', () => {
  it('se demandent par paquets de 100, sans doublon', async () => {
    const ids = Array.from({ length: SOCIAL_BATCH + 1 }, (_, i) => `b${i}`);
    stub.enqueue([
      { bento_id: 'b0', likes: 2, comments: 1, liked: true, accepts_likes: true, accepts_comments: true },
    ]);
    stub.enqueue([]);
    const social = await fetchBentoSocial(client, [...ids, 'b0']);
    assert.equal(stub.requests.length, 2);
    assert.equal(stub.requests[0]?.path, '/rest/v1/rpc/bento_social');
    assert.equal(body(0).p_bentos.length, SOCIAL_BATCH);
    assert.deepEqual(body(1).p_bentos, [`b${SOCIAL_BATCH}`]);
    assert.deepEqual(social.get('b0'), { likes: 2, comments: 1, liked: true, acceptsLikes: true, acceptsComments: true });
  });
});

describe('le cœur', () => {
  it('envoie l\'état voulu et rend celui de la base', async () => {
    stub.enqueue([{ likes: 5, liked: true }]);
    assert.deepEqual(await setLike(client, BENTO, true), { likes: 5, liked: true });
    assert.equal(stub.requests[0]?.path, '/rest/v1/rpc/set_like');
    assert.deepEqual(body(), { p_bento: BENTO, p_liked: true });
  });

  it('lève la clé de la base, que l\'app dit en phrase', async () => {
    stub.enqueue({ message: 'like_not_allowed', code: '42501' }, 403);
    await assert.rejects(setLike(client, BENTO, true), (e: unknown) => {
      assert.equal(socialErrorMessage(e), 'Tu ne peux pas aimer ce bento.');
      return true;
    });
  });
});

describe('les commentaires', () => {
  const row = (id: string, created_at: string) => ({
    id,
    bento_id: BENTO,
    body: id,
    status: 'visible',
    hidden_reason: null,
    created_at,
    author_id: 'u',
    author_pseudo: 'popy',
    author_avatar: null,
    is_mine: false,
    can_delete: false,
  });

  it('se lisent par pages, remises dans l\'ordre où ils ont été écrits', async () => {
    stub.enqueue([row('c2', '2026-10-26T10:02:00Z'), row('c1', '2026-10-26T10:01:00Z')]);
    const page = await fetchComments(client, BENTO, '2026-10-26T11:00:00Z');
    assert.deepEqual(page.map((c) => c.id), ['c1', 'c2']);
    assert.equal(stub.requests[0]?.path, '/rest/v1/rpc/list_bento_comments');
    assert.deepEqual(body(), { p_bento: BENTO, p_before: '2026-10-26T11:00:00Z', p_limit: 50 });
  });

  it('partent nettoyés, comme la base les garde', async () => {
    stub.enqueue([row('c3', '2026-10-26T10:03:00Z')]);
    const posted = await postComment(client, BENTO, '  Super\n\nbento  ');
    assert.equal(posted.id, 'c3');
    assert.deepEqual(body(), { p_bento: BENTO, p_body: 'Super bento' });
  });

  it('se suppriment, et disent quand la base n\'a rien supprimé', async () => {
    stub.enqueue(false);
    assert.equal(await deleteComment(client, 'c9'), false);
    assert.deepEqual(body(), { p_comment: 'c9' });
  });

  it('refusés par le filtre, le disent', async () => {
    stub.enqueue({ message: 'comment_refused_filter', code: '23514' }, 400);
    await assert.rejects(postComment(client, BENTO, 'x'), /comment_refused_filter/);
  });
});

describe('signaler et bloquer', () => {
  it('signale avec un motif, le détail rogné, rien s\'il est vide', async () => {
    stub.enqueue('r1');
    assert.equal(await submitReport(client, { kind: 'comment', targetId: 'c1', reason: 'spam', details: '  vu  ' }), 'r1');
    assert.deepEqual(body(), { p_target_kind: 'comment', p_target: 'c1', p_reason: 'spam', p_details: 'vu' });
    stub.enqueue('r2');
    await submitReport(client, { kind: 'account', targetId: 'u1', reason: 'hate', details: '   ' });
    assert.equal(body(1).p_details, null);
  });

  it('verse la liste locale et rend celle de la base', async () => {
    stub.enqueue([{ blocked_id: 'u1', pseudo: 'alice' }]);
    assert.deepEqual(await syncBlocks(client, ['u1', 'u2']), [{ blocked_id: 'u1', pseudo: 'alice' }]);
    assert.deepEqual(body(), { p_blocked: ['u1', 'u2'] });
  });
});
