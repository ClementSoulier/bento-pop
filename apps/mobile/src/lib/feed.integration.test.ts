import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { PAGE_SIZE, loadFeedPage, type FeedClient, type FeedRow } from './feed';
import { STUB_CLIENT_OPTIONS, startPostgrestStub, type PostgrestStub } from '../test/postgrest-stub';
import type { Database } from '@/supabase/types';

/**
 * Tests d'intégration de la requête du fil, contre un bouchon PostgREST.
 *
 * Ce qui est réellement exercé ici, c'est le constructeur d'URL de
 * `supabase-js`. C'est la partie qui casse en silence : une erreur de syntaxe
 * dans le `.or()` renvoie une erreur PostgREST, et le fil se vide sans
 * message. Aucun test de mapping ici, il vit dans `feed.test.ts`.
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

/** Vide la mémoire du bouchon entre deux cas. */
function reset() {
  stub.requests.length = 0;
}

const rowAt = (id: string, publishedAt: string, pseudo = 'someone'): FeedRow => ({
  id,
  published_at: publishedAt,
  is_featured: false,
  users: { pseudo, display_name: null },
  bento_items: [
    {
      category_id: 1,
      items: { id: `${id}-film`, title: 'Interstellar', subtitle: null, image_url: null, image_credit: null },
    },
  ],
});

/** Une page pleine, dates décroissantes. */
const fullPage = (prefix: string) =>
  Array.from({ length: PAGE_SIZE }, (_, i) =>
    rowAt(`${prefix}-${i}`, `2026-09-${String(20 - i).padStart(2, '0')}T10:00:00.000+00:00`),
  );

describe('loadFeedPage, première page', () => {
  it('trie sur (published_at, id), filtre les brouillons et borne la page', async () => {
    reset();
    stub.enqueue(fullPage('a'));
    await loadFeedPage(client);

    const [req] = stub.requests;
    assert.ok(req, 'aucune requête reçue');
    assert.equal(req.path, '/rest/v1/bentos');
    assert.match(req.query, /order=published_at\.desc,id\.desc/);
    assert.match(req.query, /published_at=not\.is\.null/);
    assert.match(req.query, new RegExp(`limit=${PAGE_SIZE}`));
  });

  it('n’émet pas de filtre de curseur sans curseur', async () => {
    reset();
    stub.enqueue([]);
    await loadFeedPage(client);
    assert.ok(!stub.requests[0]?.query.includes('or='), stub.requests[0]?.query);
  });

  /**
   * Le crédit d'image est une mention légale CC-BY-SA. Sa disparition du
   * `select` ne casserait rien de visible, la case s'afficherait simplement
   * sans attribution.
   */
  it('demande les champs que la tuile rend, et pas les autres', async () => {
    reset();
    stub.enqueue([]);
    await loadFeedPage(client);

    const { query } = stub.requests[0]!;
    for (const field of ['image_url', 'image_credit', 'title', 'subtitle', 'is_featured']) {
      assert.ok(query.includes(field), `champ manquant dans le select : ${field}`);
    }
    for (const field of ['year', 'external_source', 'external_id']) {
      assert.ok(!query.includes(field), `champ inutile demandé : ${field}`);
    }
  });
});

describe('loadFeedPage, pagination par curseur', () => {
  it('émet les deux branches du keyset', async () => {
    reset();
    stub.enqueue([]);
    await loadFeedPage(client, {
      publishedAt: '2026-08-26T22:10:09.227+00:00',
      id: 'b-42',
    });

    const { query } = stub.requests[0]!;
    assert.match(query, /or=\(published_at\.lt\.2026-08-26T22:10:09\.227\+00:00,/);
    assert.match(query, /and\(published_at\.eq\.2026-08-26T22:10:09\.227\+00:00,id\.lt\.b-42\)\)/);
  });

  /**
   * Le piège vérifié en production : un `+` non encodé est décodé en espace,
   * et PostgREST répond `22007 invalid input syntax for type timestamp with
   * time zone: "2026-08-26T22:10:09.227 00:00"`.
   *
   * `supabase-js` passe par `URL.searchParams`, qui l'encode. Ce test tombe le
   * jour où quelqu'un construit l'URL à la main.
   */
  it('encode le décalage horaire sur le fil', async () => {
    reset();
    stub.enqueue([]);
    await loadFeedPage(client, {
      publishedAt: '2026-08-26T22:10:09.227+00:00',
      id: 'b-42',
    });

    const { rawQuery } = stub.requests[0]!;
    assert.ok(rawQuery.includes('%2B00%3A00'), `décalage non encodé : ${rawQuery}`);
    assert.ok(!/published_at\.lt\.[^&]*\+/.test(rawQuery), `un + brut subsiste : ${rawQuery}`);
  });

  it('renvoie un curseur repris caractère pour caractère, et le réémet tel quel', async () => {
    reset();
    const page = fullPage('b');
    const microseconds = '2026-07-04T06:08:53.227431+00:00';
    page[page.length - 1]!.published_at = microseconds;
    page[page.length - 1]!.id = 'b-last';

    stub.enqueue(page);
    const first = await loadFeedPage(client);
    assert.deepEqual(first.nextCursor, { publishedAt: microseconds, id: 'b-last' });

    stub.enqueue([]);
    await loadFeedPage(client, first.nextCursor);
    assert.ok(
      stub.requests[1]!.query.includes(`published_at.lt.${microseconds}`),
      stub.requests[1]!.query,
    );
  });

  /**
   * Le curseur vient de la dernière ligne **brute**. Si on le prenait sur le
   * dernier bento retenu, une dernière ligne écartée par `mapFeedRow` ferait
   * redemander indéfiniment la même page.
   */
  it('avance même quand la dernière ligne de la page est écartée', async () => {
    reset();
    const page = fullPage('c');
    const last = page[page.length - 1]!;
    last.users = null;
    last.id = 'c-orphelin';

    stub.enqueue(page);
    const result = await loadFeedPage(client);

    assert.equal(result.bentos.length, PAGE_SIZE - 1, 'la ligne orpheline doit être écartée');
    assert.equal(result.nextCursor?.id, 'c-orphelin', 'le curseur doit venir de la ligne brute');
  });

  it('arrête la pagination sur une page incomplète', async () => {
    reset();
    stub.enqueue(fullPage('d').slice(0, PAGE_SIZE - 1));
    assert.equal((await loadFeedPage(client)).nextCursor, null);

    stub.enqueue([]);
    assert.equal((await loadFeedPage(client)).nextCursor, null);
  });
});

describe('loadFeedPage, erreurs', () => {
  /**
   * `loadFeaturedBentos` faisait `if (error || !data) return []`, ce qui
   * rendait une panne indiscernable d'une base vide : l'écran affichait
   * « pas encore de contenu » pendant que Supabase était tombé.
   */
  it('lève au lieu de rendre une liste vide', async () => {
    reset();
    stub.enqueue({ message: 'boom', code: '500', details: null, hint: null }, 500);
    await assert.rejects(() => loadFeedPage(client), /Feed load failed/);
  });
});
