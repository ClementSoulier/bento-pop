import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { AbortTimeoutError } from './abort-timeout';
import { FEED_QUERY_KEY } from './feed';
import type { PublicBentoResult } from './public-bento';
import {
  PUBLIC_BENTO_QUERY_ROOT,
  PUBLIC_BENTO_STALE_TIME_MS,
  publicBentoQueryKey,
  refreshPublicViews,
  shouldRetryPublicBento,
} from './public-bento-query';

/** Ce que la personne a vu en ouvrant sa page avant de publier. */
const NOTHING_ONLINE: PublicBentoResult = { pseudo: 'dark_hifus', bento: null, others: [] };

/** Ce que la base dit juste après la publication. */
const PUBLISHED: PublicBentoResult = {
  pseudo: 'dark_hifus',
  others: [],
  bento: {
    id: 'b-principal',
    slug: 'mon-bento',
    isPrimary: true,
    pseudo: 'dark_hifus',
    displayName: null,
    isGuest: false,
    isFeatured: false,
    publishedAt: '2026-09-14T08:00:00.000000+00:00',
    slots: {},
  },
};

let clients: QueryClient[] = [];

/**
 * `gcTime` infini et `clear()` après chaque test : le ramasse-miettes de React
 * Query arme des minuteurs de cinq minutes, qui garderaient le runner en vie.
 */
function newQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  clients.push(client);
  return client;
}

afterEach(() => {
  for (const client of clients) client.clear();
  clients = [];
});

async function waitFor(condition: () => boolean, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('condition jamais atteinte');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

function pageOptions(pseudo: string, answer: PublicBentoResult) {
  return {
    queryKey: publicBentoQueryKey(pseudo),
    queryFn: async () => answer,
    staleTime: PUBLIC_BENTO_STALE_TIME_MS,
  };
}

/** Ouvre la page, attend la réponse, puis la quitte : la réponse reste en cache, sans observateur. */
async function visitAndLeave(client: QueryClient, pseudo: string, answer: PublicBentoResult) {
  const observer = new QueryObserver(client, pageOptions(pseudo, answer));
  const unsubscribe = observer.subscribe(() => {});
  await waitFor(() => observer.getCurrentResult().status === 'success');
  unsubscribe();
}

/** Premier rendu de la page rouverte, calculé comme le fait `useQuery`. */
function firstRenderOnReopen(client: QueryClient, pseudo: string, answer: PublicBentoResult) {
  const options = pageOptions(pseudo, answer);
  return new QueryObserver(client, options).getOptimisticResult(
    client.defaultQueryOptions(options),
  );
}

describe('publicBentoQueryKey', () => {
  it('range un pseudo sous une seule clé, quelle que soit sa casse', () => {
    assert.deepEqual(publicBentoQueryKey('  Dark_Hifus '), [
      PUBLIC_BENTO_QUERY_ROOT,
      'dark_hifus',
      null,
    ]);
    assert.deepEqual(publicBentoQueryKey('DARK_HIFUS'), publicBentoQueryKey('dark_hifus'));
  });

  it('sépare la page du compte de celle d’un bento nommé', () => {
    // Servir l’une à la place de l’autre afficherait le mauvais bento.
    assert.notDeepEqual(
      publicBentoQueryKey('dark_hifus'),
      publicBentoQueryKey('dark_hifus', 'hebdo-38'),
    );
    assert.deepEqual(publicBentoQueryKey('dark_hifus', 'hebdo-38'), [
      PUBLIC_BENTO_QUERY_ROOT,
      'dark_hifus',
      'hebdo-38',
    ]);
  });

});

describe('shouldRetryPublicBento', () => {
  it('réessaie une fois une panne réseau, un délai dépassé ou une erreur serveur', () => {
    for (const error of [
      { status: 0 },
      new AbortTimeoutError(5000),
      { status: 500 },
      new Error('?'),
    ]) {
      assert.equal(shouldRetryPublicBento(0, error), true, JSON.stringify(error));
      assert.equal(
        shouldRetryPublicBento(1, error),
        false,
        `un seul réessai : ${JSON.stringify(error)}`,
      );
    }
  });

  it('ne réessaie jamais un refus', () => {
    for (const status of [400, 401, 404, 406]) {
      assert.equal(shouldRetryPublicBento(0, { status }), false, `${status}`);
    }
  });
});

describe('refreshPublicViews', () => {
  /**
   * Le piège du §6.3 : la personne a ouvert sa page avant de publier, et y a
   * vu « rien en ligne ». Elle publie, la page se rouvre. Le premier rendu doit
   * être le squelette, pas son bento déclaré absent.
   */
  it('fait rouvrir une page publique sur le squelette, pas sur l’ancienne réponse', async () => {
    const client = newQueryClient();
    await visitAndLeave(client, 'dark_hifus', NOTHING_ONLINE);

    refreshPublicViews(client);

    const first = firstRenderOnReopen(client, 'dark_hifus', PUBLISHED);
    assert.equal(first.status, 'pending');
    assert.equal(first.data, undefined);
  });

  /**
   * Pourquoi `resetQueries` et pas `invalidateQueries`, que prescrivait la
   * première version de la spéc. Si une version de React Query changeait ce
   * comportement, ce test le dirait.
   */
  it('là où une simple invalidation resservirait « rien en ligne »', async () => {
    const client = newQueryClient();
    await visitAndLeave(client, 'dark_hifus', NOTHING_ONLINE);

    await client.invalidateQueries({ queryKey: [PUBLIC_BENTO_QUERY_ROOT] });

    const first = firstRenderOnReopen(client, 'dark_hifus', PUBLISHED);
    assert.equal(first.status, 'success');
    assert.deepEqual(first.data, NOTHING_ONLINE);
  });

  it('remet à zéro toutes les pages publiques, pas seulement la sienne', async () => {
    const client = newQueryClient();
    await visitAndLeave(client, 'dark_hifus', NOTHING_ONLINE);
    await visitAndLeave(client, 'keremasan', { pseudo: 'keremasan', bento: null, others: [] });

    refreshPublicViews(client);

    assert.equal(client.getQueryData(publicBentoQueryKey('dark_hifus')), undefined);
    assert.equal(client.getQueryData(publicBentoQueryKey('keremasan')), undefined);
  });

  /**
   * Chantier 16 : un compte a désormais deux pages en cache, la sienne et
   * celle de chaque bento nommé. Une page de bento périmée dirait « rien en
   * ligne » juste après sa publication, exactement comme le piège du §6.3.
   */
  it('remet à zéro la page d’un bento nommé autant que celle du compte', async () => {
    const client = newQueryClient();
    const observer = new QueryObserver(client, {
      queryKey: publicBentoQueryKey('dark_hifus', 'hebdo-38'),
      queryFn: async () => NOTHING_ONLINE,
      staleTime: PUBLIC_BENTO_STALE_TIME_MS,
    });
    const unsubscribe = observer.subscribe(() => {});
    await waitFor(() => observer.getCurrentResult().status === 'success');
    unsubscribe();
    await visitAndLeave(client, 'dark_hifus', NOTHING_ONLINE);

    refreshPublicViews(client);

    assert.equal(client.getQueryData(publicBentoQueryKey('dark_hifus')), undefined);
    assert.equal(client.getQueryData(publicBentoQueryKey('dark_hifus', 'hebdo-38')), undefined);
  });

  it('invalide le fil sans le vider', () => {
    const client = newQueryClient();
    client.setQueryData(FEED_QUERY_KEY, { pages: ['page 1'] });

    refreshPublicViews(client);

    assert.equal(client.getQueryState(FEED_QUERY_KEY)?.isInvalidated, true);
    assert.deepEqual(client.getQueryData(FEED_QUERY_KEY), { pages: ['page 1'] });
  });
});
