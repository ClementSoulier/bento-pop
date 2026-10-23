import assert from 'node:assert/strict';
import { after, afterEach, before, describe, it } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import {
  STUB_CLIENT_OPTIONS,
  startPostgrestStub,
  type PostgrestStub,
} from '../test/postgrest-stub';
import {
  bentoVisitsQueryOptions,
  loadBentoVisits,
  withVisits,
  writeShowVisits,
  type VisitsClient,
} from './visits';
import type { Database } from '@/supabase/types';

/**
 * Le compteur de visites de l'app, chantier 8, avec un vrai `supabase-js` et un
 * vrai React Query contre le bouchon PostgREST.
 */

const BENTO = '3f2b8c1e-5d4a-4b6f-9e0d-1a2b3c4d5e6f';
const USER = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

let stub: PostgrestStub;
let client: VisitsClient;

before(async () => {
  stub = await startPostgrestStub();
  client = createClient<Database>(stub.url, 'cle-anon-de-test', STUB_CLIENT_OPTIONS);
});

afterEach(() => {
  stub.requests.length = 0;
});

after(() => stub.close());

describe('loadBentoVisits', () => {
  it('compte la visite et rend le compteur, sur la page d’un bento', async () => {
    stub.enqueue(47);
    assert.equal(await loadBentoVisits(client, BENTO, 'visit'), 47);
    const [request] = stub.requests;
    assert.equal(request?.method, 'POST');
    assert.equal(request?.path, '/rest/v1/rpc/record_bento_visit_app');
    assert.deepEqual(JSON.parse(request?.body ?? '{}'), { p_bento: BENTO });
  });

  it('lit seulement le compteur, sur le profil', async () => {
    stub.enqueue(12);
    assert.equal(await loadBentoVisits(client, BENTO, 'own'), 12);
    assert.equal(stub.requests[0]?.path, '/rest/v1/rpc/bento_visit_count');
  });

  it('rend nul un compteur masqué, sans le confondre avec zéro', async () => {
    stub.enqueue(null);
    assert.equal(await loadBentoVisits(client, BENTO, 'visit'), null);
    stub.enqueue(0);
    assert.equal(await loadBentoVisits(client, BENTO, 'visit'), 0);
  });

  it('lève une erreur de la base, sans valeur de repli', async () => {
    stub.enqueue({ code: '42501', message: 'Une visite d’app demande une session.' }, 403);
    await assert.rejects(
      loadBentoVisits(client, BENTO, 'visit'),
      (error: { code?: string }) => error.code === '42501',
    );
  });
});

describe('bentoVisitsQueryOptions', () => {
  it('compte à chaque affichage, et ne réessaie jamais', async () => {
    const queryClient = new QueryClient();
    const options = bentoVisitsQueryOptions(client, BENTO, 'visit', 1000);
    assert.equal(options.retry, false);

    const display = async () => {
      const observer = new QueryObserver(queryClient, options);
      const done = new Promise<number | null | undefined>((resolve) => {
        const unsubscribe = observer.subscribe((result) => {
          if (result.fetchStatus === 'idle' && result.status !== 'pending') {
            unsubscribe();
            resolve(result.data);
          }
        });
      });
      return done;
    };

    stub.enqueue(1);
    assert.equal(await display(), 1);
    // Un second affichage du même bento : la valeur en cache, puis un nouvel
    // appel, que la base dédoublonne d'elle-même.
    stub.enqueue(1);
    assert.equal(await display(), 1);
    assert.equal(stub.requests.length, 2);
    queryClient.clear();
  });

  it('sépare dans le cache la page, qui compte, et le profil, qui lit', () => {
    assert.notDeepEqual(
      bentoVisitsQueryOptions(client, BENTO, 'visit').queryKey,
      bentoVisitsQueryOptions(client, BENTO, 'own').queryKey,
    );
  });
});

describe('withVisits', () => {
  it('ajoute le compteur à la ligne quand il est connu, zéro compris', () => {
    assert.equal(
      withVisits('bento publié le 3 mai 2026', 47),
      'bento publié le 3 mai 2026 · 47\u00a0visites',
    );
    assert.equal(
      withVisits('bento publié le 3 mai 2026', 0),
      'bento publié le 3 mai 2026 · 0\u00a0visite',
    );
  });

  it('laisse la ligne telle quelle sans compteur', () => {
    assert.equal(withVisits('bento publié le 3 mai 2026', null), 'bento publié le 3 mai 2026');
    assert.equal(withVisits('bento publié le 3 mai 2026', undefined), 'bento publié le 3 mai 2026');
  });
});

describe('writeShowVisits', () => {
  it('n’écrit que le réglage, sur la ligne du compte', async () => {
    stub.enqueue(null, 204);
    await writeShowVisits(client, USER, false);
    const [request] = stub.requests;
    assert.equal(request?.method, 'PATCH');
    assert.equal(request?.path, '/rest/v1/users');
    assert.equal(request?.query, `id=eq.${USER}`);
    assert.deepEqual(JSON.parse(request?.body ?? '{}'), { show_visits: false });
  });
});
