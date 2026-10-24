import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { loadAccountBentosPage } from './account-bentos';
import { PAGE_SIZE, type FeedClient, type FeedRow } from './feed';
import {
  STUB_CLIENT_OPTIONS,
  startPostgrestStub,
  type PostgrestStub,
  type StubRequest,
} from '../test/postgrest-stub';
import type { Database } from '@/supabase/types';

/**
 * La liste des autres bentos d'un compte, chantier 21 (D2, D11) : la requête
 * du fil, limitée au compte, et sous un bento nommé, le principal en tête
 * (§5.1), demandé à part en même temps que la première page des autres.
 */

let stub: PostgrestStub;
let client: FeedClient;

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

const rowAt = (id: string, publishedAt: string, isPrimary = false): FeedRow => ({
  id,
  slug: isPrimary ? 'mon-bento' : id,
  is_primary: isPrimary,
  published_at: publishedAt,
  is_featured: false,
  user_id: 'u-1',
  users: { pseudo: 'recette', display_name: null, kind: 'member', avatar: null },
  bento_items: [
    {
      category_id: 1,
      items: { id: `${id}-film`, title: 'Dune', subtitle: null, image_url: null, image_credit: null },
    },
  ],
});

const params = (request: StubRequest) => new URLSearchParams(request.rawQuery);
const primaryOnly = (request: StubRequest) => params(request).get('is_primary') === 'eq.true';
const othersOnly = (request: StubRequest) => params(request).get('is_primary') === 'eq.false';

/** Une page pleine des autres, dates décroissantes. */
const fullPage = () =>
  Array.from({ length: PAGE_SIZE }, (_, i) =>
    rowAt(`b-${i}`, `2026-10-${String(20 - i).padStart(2, '0')}T10:00:00.000+00:00`),
  );

describe('loadAccountBentosPage', () => {
  it('sous le principal, lit les autres en une requête, sans lui', async () => {
    stub.enqueue([rowAt('b-1', '2026-10-20T10:00:00.000+00:00')]);
    const page = await loadAccountBentosPage(client, 'u-1', { id: 'b-p', isPrimary: true }, null);

    assert.equal(stub.requests.length, 1);
    const sent = params(stub.requests[0]!);
    assert.equal(sent.get('user_id'), 'eq.u-1');
    assert.equal(sent.get('id'), 'neq.b-p');
    assert.equal(sent.get('is_primary'), null);
    assert.deepEqual(
      page.bentos.map((b) => b.bentoId),
      ['b-1'],
    );
  });

  it('sous un bento nommé, met le principal en tête de la première page', async () => {
    // Les deux requêtes partent ensemble : chaque réponse vise la sienne.
    stub.enqueue([rowAt('b-p', '2026-09-01T10:00:00.000+00:00', true)], 200, primaryOnly);
    stub.enqueue(fullPage(), 200, othersOnly);
    const page = await loadAccountBentosPage(client, 'u-1', { id: 'b-3', isPrimary: false }, null);

    assert.equal(stub.requests.length, 2);
    const others = stub.requests.find(othersOnly);
    assert.ok(others, 'les autres, sans le principal');
    assert.equal(params(others).get('id'), 'neq.b-3');
    assert.equal(params(others).get('user_id'), 'eq.u-1');
    assert.ok(stub.requests.find(primaryOnly), 'le principal, à part');

    assert.equal(page.bentos[0]?.bentoId, 'b-p');
    assert.equal(page.bentos.length, PAGE_SIZE + 1);
    // Le curseur vient des autres : le principal n'est pas dans leur ordre.
    assert.deepEqual(page.nextCursor, { publishedAt: '2026-10-13T10:00:00.000+00:00', id: 'b-7' });
  });

  it('ne redemande pas le principal aux pages suivantes', async () => {
    stub.enqueue([]);
    const cursor = { publishedAt: '2026-10-13T10:00:00.000+00:00', id: 'b-7' };
    await loadAccountBentosPage(client, 'u-1', { id: 'b-3', isPrimary: false }, cursor);

    assert.equal(stub.requests.length, 1);
    assert.equal(params(stub.requests[0]!).get('is_primary'), 'eq.false');
    assert.match(stub.requests[0]!.query, /or=\(published_at\.lt\.2026-10-13T10:00:00\.000\+00:00,/);
  });

  it('sans principal en ligne, garde la liste', async () => {
    stub.enqueue([], 200, primaryOnly);
    stub.enqueue([rowAt('b-1', '2026-10-20T10:00:00.000+00:00')], 200, othersOnly);
    const page = await loadAccountBentosPage(client, 'u-1', { id: 'b-3', isPrimary: false }, null);
    assert.deepEqual(
      page.bentos.map((b) => b.bentoId),
      ['b-1'],
    );
  });
});
