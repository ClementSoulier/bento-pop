import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import {
  SUGGESTIONS_COUNT,
  loadSuggestions,
  type SuggestionRow,
  type SuggestionsClient,
} from './suggestions';
import { STUB_CLIENT_OPTIONS, startPostgrestStub, type PostgrestStub } from '../test/postgrest-stub';
import type { Database } from '@/supabase/types';

/**
 * Tests d'intégration de l'appel à `popular_items`, contre un bouchon
 * PostgREST.
 *
 * Ce qui est exercé ici c'est le vrai `supabase-js` : le verbe, le chemin et
 * le corps réellement envoyés sur le fil. Une RPC se casse autrement qu'une
 * requête de table, et de façon plus silencieuse : un nom d'argument qui
 * dérive du SQL donne un `PGRST202 function not found` avec la même tête
 * qu'une fonction absente, et un `lim` oublié laisse Postgres appliquer son
 * défaut sans que rien ne le signale.
 *
 * Le mapping vit dans `suggestions.test.ts`, il n'est pas rejoué ici.
 *
 * Pas de test contre la vraie base : la CI n'a pas d'identifiants Supabase.
 * Les propriétés qui ne s'observent qu'en production (stabilité de l'ordre,
 * latence, statut des items) sont vérifiées par
 * `apps/mobile/scripts/check-popular-items.mjs`, lancé à la main.
 */

let stub: PostgrestStub;
let client: SuggestionsClient;

before(async () => {
  stub = await startPostgrestStub();
  client = createClient<Database>(stub.url, 'stub-anon-key', STUB_CLIENT_OPTIONS);
});

after(async () => {
  await stub.close();
});

function reset() {
  stub.requests.length = 0;
}

const row = (id: string, picks: number): SuggestionRow => ({
  id,
  title: `Titre ${id}`,
  subtitle: null,
  year: null,
  image_url: null,
  image_credit: null,
  picks,
});

/** Le corps JSON de la dernière requête reçue. */
function lastBody(): Record<string, unknown> {
  const req = stub.requests.at(-1);
  assert.ok(req, 'aucune requête reçue');
  return JSON.parse(req.body) as Record<string, unknown>;
}

describe('loadSuggestions, forme de la requête', () => {
  it('poste sur la fonction popular_items', async () => {
    reset();
    stub.enqueue([]);
    await loadSuggestions(client, 'film');

    const req = stub.requests.at(-1);
    assert.ok(req);
    // PostgREST n'expose les fonctions qu'en POST. Un `GET` répondrait 404
    // et l'écran conclurait à une absence de suggestions.
    assert.equal(req.method, 'POST');
    assert.equal(req.path, '/rest/v1/rpc/popular_items');
  });

  it('transmet les trois arguments attendus par le SQL', async () => {
    reset();
    stub.enqueue([]);
    await loadSuggestions(client, 'track');

    // Les noms doivent correspondre mot pour mot à la signature de
    // `20260912000000_popular_items.sql`. PostgREST résout la surcharge par
    // les noms d'arguments : une faute de frappe donne `PGRST202`.
    assert.deepEqual(lastBody(), {
      category_key: 'track',
      lim: SUGGESTIONS_COUNT,
      exclude_item: null,
    });
  });

  it('borne à 12 par défaut, et respecte une limite explicite', async () => {
    reset();
    stub.enqueue([]);
    await loadSuggestions(client, 'film');
    assert.equal(lastBody().lim, 12);

    stub.enqueue([]);
    await loadSuggestions(client, 'film', { limit: 3 });
    assert.equal(lastBody().lim, 3);
  });

  it('passe exclude_item quand une case est déjà remplie', async () => {
    reset();
    stub.enqueue([]);
    await loadSuggestions(client, 'series', { excludeItemId: 'item-42' });
    assert.equal(lastBody().exclude_item, 'item-42');
  });

  /**
   * `undefined` disparaîtrait de la sérialisation JSON, et Postgres
   * appliquerait son défaut. Le résultat serait le même, mais le corps de la
   * requête différerait selon le chemin d'appel, ce qui rendrait ce test
   * dépendant d'un détail de `JSON.stringify`.
   */
  it('envoie exclude_item à null plutôt que de l\'omettre', async () => {
    reset();
    stub.enqueue([]);
    await loadSuggestions(client, 'place', { excludeItemId: undefined });
    assert.ok('exclude_item' in lastBody(), 'clé absente du corps');
    assert.equal(lastBody().exclude_item, null);
  });

  it('appelle une fois par catégorie, sans requête parasite', async () => {
    reset();
    stub.enqueue([]);
    await loadSuggestions(client, 'creator');
    assert.equal(stub.requests.length, 1);
  });
});

describe('loadSuggestions, réponse', () => {
  it('mappe les lignes dans l\'ordre reçu', async () => {
    reset();
    // L'ordre vient du SQL. Le client ne doit surtout pas retrier : il
    // n'a pas `created_at`, donc il ne pourrait pas reproduire le départage
    // et casserait la stabilité que le SQL garantit.
    stub.enqueue([row('c', 4), row('a', 2), row('b', 0)]);
    const items = await loadSuggestions(client, 'film');
    assert.deepEqual(
      items.map((i) => i.id),
      ['c', 'a', 'b'],
    );
    assert.deepEqual(
      items.map((i) => i.picks),
      [4, 2, 0],
    );
  });

  it('rend une liste vide sur un catalogue vide', async () => {
    reset();
    stub.enqueue([]);
    assert.deepEqual(await loadSuggestions(client, 'film'), []);
  });

  it('rend une liste vide quand PostgREST renvoie null', async () => {
    reset();
    stub.enqueue(null);
    assert.deepEqual(await loadSuggestions(client, 'film'), []);
  });

  /**
   * Le point qui sépare « pas de suggestions » de « la base est tombée ».
   * Un `return []` sur erreur rendrait les deux indiscernables, et l'écran
   * afficherait un catalogue vide pendant une panne.
   */
  it('lève sur erreur, en conservant le message de PostgREST', async () => {
    reset();
    stub.enqueue({ message: 'function public.popular_items does not exist', code: 'PGRST202' }, 404);
    await assert.rejects(
      () => loadSuggestions(client, 'film'),
      (err: Error) => {
        assert.match(err.message, /Suggestions load failed/);
        assert.match(err.message, /does not exist/);
        return true;
      },
    );
  });

  it('lève aussi sur une erreur serveur', async () => {
    reset();
    stub.enqueue({ message: 'panne simulée', code: '500' }, 500);
    await assert.rejects(() => loadSuggestions(client, 'film'), /Suggestions load failed/);
  });
});
