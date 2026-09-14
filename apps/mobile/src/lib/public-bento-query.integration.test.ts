import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, afterEach, before, describe, it } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { AbortTimeoutError } from './abort-timeout';
import type { PublicBentoClient } from './public-bento';
import { publicBentoQueryOptions } from './public-bento-query';
import {
  STUB_CLIENT_OPTIONS,
  startPostgrestStub,
  type PostgrestStub,
} from '../test/postgrest-stub';
import type { Database } from '@/supabase/types';

/**
 * La politique d'abandon et de réessai de la page publique, avec un vrai
 * `supabase-js` et un vrai React Query, contre deux serveurs locaux : le
 * bouchon PostgREST, et un serveur qui accepte les requêtes sans jamais
 * répondre, le réseau du métro de la spéc (§4.6).
 */

/** Délai d'abandon réduit pour les tests : la mécanique est la même qu'à 5 s. */
const TIMEOUT_MS = 60;

type Silent = {
  url: string;
  received: () => number;
  abandoned: () => number;
  close: () => Promise<void>;
};

async function startSilentServer(): Promise<Silent> {
  let received = 0;
  let abandoned = 0;
  const server: Server = createServer((_req, res) => {
    received += 1;
    // Jamais de réponse : seule la déconnexion du client ferme l'échange.
    res.on('close', () => {
      abandoned += 1;
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    received: () => received,
    abandoned: () => abandoned,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

async function waitFor(condition: () => boolean, timeoutMs = 4000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('condition jamais atteinte');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

let silent: Silent;
let stub: PostgrestStub;
let queryClients: QueryClient[] = [];

before(async () => {
  silent = await startSilentServer();
  stub = await startPostgrestStub();
});

after(async () => {
  await silent.close();
  await stub.close();
});

afterEach(() => {
  for (const client of queryClients) client.clear();
  queryClients = [];
  stub.requests.length = 0;
});

function newQueryClient(): QueryClient {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  queryClients.push(client);
  return client;
}

function supabaseOn(url: string): PublicBentoClient {
  return createClient<Database>(url, 'stub-anon-key', STUB_CLIENT_OPTIONS);
}

describe('page publique, réseau qui ne répond pas', () => {
  it('abandonne la tentative à l’échéance, et annule vraiment la requête', async () => {
    const before = silent.abandoned();
    const { queryFn } = publicBentoQueryOptions(supabaseOn(silent.url), 'dark_hifus', TIMEOUT_MS);

    const started = Date.now();
    await assert.rejects(
      () => queryFn({ signal: new AbortController().signal }),
      AbortTimeoutError,
    );
    assert.ok(Date.now() - started < TIMEOUT_MS + 300, `${Date.now() - started} ms`);

    await waitFor(() => silent.abandoned() > before);
  });

  /**
   * La borne de la spéc : deux tentatives et une pause, puis l'erreur. À 5 s
   * par tentative, 11 s ; ici, 60 ms + 1 s + 60 ms.
   */
  it('réessaie une seule fois, puis rend l’erreur', async () => {
    const receivedBefore = silent.received();
    const options = publicBentoQueryOptions(supabaseOn(silent.url), 'dark_hifus', TIMEOUT_MS);
    const observer = new QueryObserver(newQueryClient(), options);

    const started = Date.now();
    const unsubscribe = observer.subscribe(() => {});
    await waitFor(() => observer.getCurrentResult().status === 'error');
    const elapsed = Date.now() - started;
    unsubscribe();

    assert.equal(silent.received() - receivedBefore, 2, 'une tentative et un réessai');
    assert.ok(observer.getCurrentResult().error instanceof AbortTimeoutError);
    assert.ok(elapsed >= 1000 && elapsed < 2000, `${elapsed} ms`);
  });

  it('annule la requête en cours quand on quitte la page', async () => {
    const abandonedBefore = silent.abandoned();
    const receivedBefore = silent.received();
    const options = publicBentoQueryOptions(supabaseOn(silent.url), 'keremasan', 10_000);
    const observer = new QueryObserver(newQueryClient(), options);

    const unsubscribe = observer.subscribe(() => {});
    await waitFor(() => silent.received() > receivedBefore);
    unsubscribe();

    await waitFor(() => silent.abandoned() > abandonedBefore, 1000);
  });
});

describe('page publique, requête refusée', () => {
  it('rend l’erreur sans réessayer ni attendre', async () => {
    stub.enqueue({ message: 'bad select', code: 'PGRST100', details: null, hint: null }, 400);
    stub.enqueue({ message: 'bad select', code: 'PGRST100', details: null, hint: null }, 400);
    const options = publicBentoQueryOptions(supabaseOn(stub.url), 'dark_hifus');
    const observer = new QueryObserver(newQueryClient(), options);

    const started = Date.now();
    const unsubscribe = observer.subscribe(() => {});
    await waitFor(() => observer.getCurrentResult().status === 'error');
    unsubscribe();

    assert.equal(stub.requests.length, 1);
    assert.ok(Date.now() - started < 500, `${Date.now() - started} ms`);
  });
});
