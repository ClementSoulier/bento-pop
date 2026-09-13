import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import {
  SEARCH_LIMIT,
  SHARED_ITEMS_COUNT,
  loadSharedItems,
  searchBentos,
  type SearchClient,
  type SearchRow,
  type SharedItemRow,
} from './search';
import { STUB_CLIENT_OPTIONS, startPostgrestStub, type PostgrestStub } from '../test/postgrest-stub';
import type { Database } from '@/supabase/types';

/**
 * Tests d'intégration des deux appels de l'onglet « Trouver », contre un
 * bouchon PostgREST.
 *
 * Ce qui est exercé ici, c'est le vrai `supabase-js` : le verbe, le chemin et
 * le corps réellement envoyés. Le point le plus sensible du chantier y est :
 * la chaîne saisie doit partir **intacte**, parce que l'échappement des
 * jokers `ilike` vit en SQL. Un échappement client ajouté par réflexe
 * doublerait les antislashs et ferait disparaître `dark_hifus` de ses propres
 * résultats, sans erreur ni trace.
 *
 * Le mapping vit dans `search.test.ts`, il n'est pas rejoué ici.
 */

let stub: PostgrestStub;
let client: SearchClient;

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

function lastBody(): Record<string, unknown> {
  const req = stub.requests.at(-1);
  assert.ok(req, 'aucune requête reçue');
  return JSON.parse(req.body) as Record<string, unknown>;
}

const row = (pseudo: string): SearchRow => ({
  bento_id: `bento-${pseudo}`,
  pseudo,
  display_name: null,
  is_featured: false,
  match_kind: 'pseudo',
  item_id: null,
  item_title: null,
  category_id: null,
  score: 2,
});

const shared = (id: string, picks: number): SharedItemRow => ({
  id,
  title: `Titre ${id}`,
  category_id: 1,
  picks,
});

describe('searchBentos, forme de la requête', () => {
  it('poste sur la fonction search_bentos', async () => {
    reset();
    stub.enqueue([]);
    await searchBentos(client, 'inception');

    const req = stub.requests.at(-1);
    assert.ok(req);
    // PostgREST n'expose les fonctions qu'en POST. Un GET répondrait 404 et
    // l'écran conclurait à une absence de résultats.
    assert.equal(req.method, 'POST');
    assert.equal(req.path, '/rest/v1/rpc/search_bentos');
  });

  it('transmet les deux arguments attendus par le SQL', async () => {
    reset();
    stub.enqueue([]);
    await searchBentos(client, 'inception');
    // Les noms correspondent mot pour mot à la signature SQL : PostgREST
    // résout la surcharge par les noms d'arguments, une faute donne PGRST202.
    assert.deepEqual(lastBody(), { q: 'inception', lim: SEARCH_LIMIT });
  });

  it('borne à 20 par défaut, et respecte une limite explicite', async () => {
    reset();
    stub.enqueue([]);
    await searchBentos(client, 'angers');
    assert.equal(lastBody().lim, 20);

    stub.enqueue([]);
    await searchBentos(client, 'angers', { limit: 5 });
    assert.equal(lastBody().lim, 5);
  });

  /**
   * Le test qui protège le chantier. `_` et `%` sont des jokers `ilike`, et
   * 14 pseudos de la production en contiennent. Ils sont échappés dans la
   * fonction SQL ; les échapper aussi ici produirait `dark\_hifus`, que la
   * base chercherait littéralement, antislash compris.
   */
  it('envoie la requête sans échapper les jokers ilike', async () => {
    reset();
    stub.enqueue([]);
    await searchBentos(client, 'dark_hifus');
    assert.equal(lastBody().q, 'dark_hifus');

    stub.enqueue([]);
    await searchBentos(client, '100%');
    assert.equal(lastBody().q, '100%');

    stub.enqueue([]);
    await searchBentos(client, 'a\\b');
    assert.equal(lastBody().q, 'a\\b');
  });

  it('retire les espaces de bord, et rien d\'autre', async () => {
    reset();
    stub.enqueue([]);
    await searchBentos(client, "  Le Seigneur des anneaux : La Communauté de l'anneau  ");
    assert.equal(lastBody().q, "Le Seigneur des anneaux : La Communauté de l'anneau");
  });

  it('ne transforme pas la casse', async () => {
    reset();
    stub.enqueue([]);
    await searchBentos(client, 'Inception');
    assert.equal(lastBody().q, 'Inception');
  });

  it('appelle une fois, sans requête parasite', async () => {
    reset();
    stub.enqueue([]);
    await searchBentos(client, 'joyca');
    assert.equal(stub.requests.length, 1);
  });
});

describe('searchBentos, réponse', () => {
  it('rend les lignes dans l\'ordre reçu', async () => {
    reset();
    stub.enqueue([row('c'), row('a'), row('b')]);
    const rows = await searchBentos(client, 'abc');
    assert.deepEqual(rows.map((r) => r.pseudo), ['c', 'a', 'b']);
  });

  it('rend une liste vide sur zéro résultat', async () => {
    reset();
    stub.enqueue([]);
    assert.deepEqual(await searchBentos(client, 'zzzz'), []);
  });

  it('rend une liste vide quand PostgREST renvoie null', async () => {
    reset();
    stub.enqueue(null);
    assert.deepEqual(await searchBentos(client, 'zzzz'), []);
  });

  /**
   * Le point qui sépare « aucun résultat » de « la base est tombée ». Sans
   * ça, l'écran afficherait « Rien pour xyz » pendant une panne.
   */
  it('lève sur erreur, en conservant le message de PostgREST', async () => {
    reset();
    stub.enqueue({ message: 'function public.search_bentos does not exist', code: 'PGRST202' }, 404);
    await assert.rejects(
      () => searchBentos(client, 'incep'),
      (err: Error) => {
        assert.match(err.message, /Search failed/);
        assert.match(err.message, /does not exist/);
        return true;
      },
    );
  });

  it('lève aussi sur une erreur serveur', async () => {
    reset();
    stub.enqueue({ message: 'panne simulée', code: '500' }, 500);
    await assert.rejects(() => searchBentos(client, 'incep'), /Search failed/);
  });
});

describe('loadSharedItems', () => {
  it('poste sur shared_items avec sa limite', async () => {
    reset();
    stub.enqueue([]);
    await loadSharedItems(client);

    const req = stub.requests.at(-1);
    assert.ok(req);
    assert.equal(req.method, 'POST');
    assert.equal(req.path, '/rest/v1/rpc/shared_items');
    assert.deepEqual(lastBody(), { lim: SHARED_ITEMS_COUNT });
  });

  it('respecte une limite explicite', async () => {
    reset();
    stub.enqueue([]);
    await loadSharedItems(client, 3);
    assert.equal(lastBody().lim, 3);
  });

  it('mappe les catégories et préserve l\'ordre', async () => {
    reset();
    stub.enqueue([shared('a', 4), shared('b', 2)]);
    const items = await loadSharedItems(client);
    assert.deepEqual(items.map((i) => i.id), ['a', 'b']);
    assert.deepEqual(items.map((i) => i.picks), [4, 2]);
    assert.equal(items[0]?.category, 'film');
  });

  /**
   * Une puce sans catégorie n'a rien à sauver, contrairement à un résultat de
   * recherche qui désigne quand même une personne joignable.
   */
  it('écarte une ligne dont la catégorie est inconnue', async () => {
    reset();
    stub.enqueue([{ ...shared('a', 4), category_id: 99 }, shared('b', 2)]);
    const items = await loadSharedItems(client);
    assert.deepEqual(items.map((i) => i.id), ['b']);
  });

  it('lève sur erreur', async () => {
    reset();
    stub.enqueue({ message: 'panne simulée', code: '500' }, 500);
    await assert.rejects(() => loadSharedItems(client), /Shared items load failed/);
  });
});
