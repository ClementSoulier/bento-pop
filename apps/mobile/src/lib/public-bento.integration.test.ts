import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { loadPublicBento, type PublicBentoClient, type PublicBentoRow } from './public-bento';
import {
  STUB_CLIENT_OPTIONS,
  startPostgrestStub,
  type PostgrestStub,
} from '../test/postgrest-stub';
import type { Database } from '@/supabase/types';

/**
 * Tests d'intégration du chargement de la page publique, contre un bouchon
 * PostgREST.
 *
 * Ce qui est exercé, c'est le constructeur d'URL de `supabase-js`. La
 * syntaxe du filtre sur ressource imbriquée casse en silence, et une erreur
 * PostgREST se solderait par une page « introuvable ». Le mapping vit dans
 * `public-bento.test.ts`.
 */

let stub: PostgrestStub;
let client: PublicBentoClient;

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

/** Paramètres de la seule requête reçue, décodés. */
function onlyRequest() {
  assert.equal(stub.requests.length, 1, `${stub.requests.length} requêtes au lieu d'une`);
  const req = stub.requests[0]!;
  return { req, params: new URLSearchParams(req.rawQuery) };
}

const rowFor = (
  pseudo: string,
  bentos: PublicBentoRow['bentos'] | undefined = undefined,
): PublicBentoRow => ({
  pseudo,
  display_name: null,
  kind: 'member',
  bentos:
    bentos === undefined
      ? {
          id: `b-${pseudo}`,
          slug: 'mon-bento',
          is_primary: true,
          published_at: '2026-09-08T15:49:11.227431+00:00',
          is_featured: false,
          bento_items: [
            {
              category_id: 1,
              items: {
                id: 'it-film',
                title: 'Inception',
                subtitle: null,
                image_url: null,
                image_credit: null,
              },
            },
          ],
        }
      : bentos,
});

describe('loadPublicBento, forme de la requête', () => {
  it('fait un seul GET sur `users`, avec exactement les champs rendus', async () => {
    reset();
    stub.enqueue([rowFor('dark_hifus')]);
    await loadPublicBento(client, 'dark_hifus');

    const { req, params } = onlyRequest();
    assert.equal(req.method, 'GET');
    assert.equal(req.path, '/rest/v1/users');
    assert.equal(
      params.get('select'),
      'pseudo,display_name,kind,' +
        'bentos(id,slug,is_primary,published_at,is_featured,' +
        'bento_items(category_id,items(id,title,subtitle,image_url,image_credit)))',
    );
    for (const field of ['year', 'external_source', 'external_id', 'created_at']) {
      assert.ok(!req.query.includes(field), `champ inutile demandé : ${field}`);
    }
  });

  /**
   * Sur la ressource imbriquée et pas sur la ligne : c'est ce qui laisse
   * revenir un compte sans rien en ligne, avec `bentos: null`, au lieu de le
   * confondre avec un pseudo inconnu.
   */
  it('filtre les brouillons sur la ressource imbriquée', async () => {
    reset();
    stub.enqueue([]);
    await loadPublicBento(client, 'dark_hifus');

    const { params } = onlyRequest();
    assert.equal(params.get('bentos.published_at'), 'not.is.null');
    assert.equal(params.get('published_at'), null, 'le filtre ne doit pas porter sur `users`');
  });

  /**
   * `bentopop://u/buyt_k` affichait le bento de `buyt.k` : `_` est le joker
   * « un caractère » d'`ilike`. Échappé à la source, la base ne rend que la
   * correspondance exacte.
   */
  it('échappe le joker `_` et garde la limite de cinq lignes', async () => {
    reset();
    stub.enqueue([]);
    await loadPublicBento(client, '  dark_hifus ');

    const { req, params } = onlyRequest();
    assert.equal(params.get('pseudo'), 'ilike.dark\\_hifus');
    assert.ok(req.rawQuery.includes('dark%5C_hifus'), `antislash non encodé : ${req.rawQuery}`);
    assert.equal(params.get('limit'), '5');
  });

  it('ne part pas pour un pseudo qui ne peut pas exister', async () => {
    reset();
    for (const pseudo of ['', 'ab', 'dark hifus', 'dark%', 'a'.repeat(21), '../users', 'é_à']) {
      assert.equal(await loadPublicBento(client, pseudo), null, `« ${pseudo} »`);
    }
    assert.equal(stub.requests.length, 0);
  });
});

describe('loadPublicBento, réponses', () => {
  it('rend le bento en ligne', async () => {
    reset();
    stub.enqueue([rowFor('dark_hifus')]);
    const result = await loadPublicBento(client, 'dark_hifus');
    assert.equal(result?.pseudo, 'dark_hifus');
    assert.equal(result?.bento?.slots.film?.title, 'Inception');
  });

  it('distingue un compte sans rien en ligne d’un pseudo inconnu', async () => {
    reset();
    stub.enqueue([rowFor('keremasan', null)]);
    assert.deepEqual(await loadPublicBento(client, 'keremasan'), {
      pseudo: 'keremasan',
      bento: null,
      others: [],
    });

    stub.enqueue([]);
    assert.equal(await loadPublicBento(client, 'personne_ici'), null);
  });

  /**
   * Seconde ligne de défense si l'échappement venait à sauter : une ligne
   * remontée par le joker n'est pas retenue.
   */
  it('écarte un jumeau que le joker aurait remonté', async () => {
    reset();
    stub.enqueue([rowFor('buyt.k')]);
    assert.equal(await loadPublicBento(client, 'buyt_k'), null);
  });

  it('retient la correspondance exacte, à la casse près, parmi plusieurs lignes', async () => {
    reset();
    stub.enqueue([rowFor('darkahifus'), rowFor('Dark_Hifus')]);
    assert.equal((await loadPublicBento(client, 'dark_hifus'))?.pseudo, 'Dark_Hifus');
  });
});

describe('loadPublicBento, erreurs', () => {
  /**
   * La régression du §4.6 de la spéc : `findUserByPseudo` avalait l'erreur,
   * et une panne affichait « Bento introuvable ».
   */
  it('lève sur une erreur serveur, avec son statut, au lieu de rendre `null`', async () => {
    reset();
    stub.enqueue({ message: 'boom', code: '500', details: null, hint: null }, 500);
    await assert.rejects(
      () => loadPublicBento(client, 'dark_hifus'),
      (error: Error & { status?: number }) => {
        assert.match(error.message, /Public bento load failed: boom/);
        assert.equal(error.status, 500);
        return true;
      },
    );
  });

  /** `query-client.ts` ne réessaie pas une 4xx, à condition de la reconnaître. */
  it('lève une requête refusée avec son statut 4xx', async () => {
    reset();
    stub.enqueue({ message: 'bad select', code: 'PGRST100', details: null, hint: null }, 400);
    await assert.rejects(
      () => loadPublicBento(client, 'dark_hifus'),
      (error: Error & { status?: number }) => error.status === 400,
    );
  });

  /**
   * Le cas du métro : plus de réseau du tout. `supabase-js` ne lève pas, il
   * rend une erreur de statut 0, qui doit remonter et rester réessayable.
   *
   * Et tout de suite : `postgrest-js` réessaie de lui-même trois fois une
   * lecture en échec réseau, sept secondes au total, et ce test durait
   * justement sept secondes avant `.retry(false)`.
   */
  it('lève sur une panne réseau, avec le statut 0, sans réessai caché', async () => {
    const dead = await startPostgrestStub();
    const unreachable = dead.url;
    await dead.close();
    const offline = createClient<Database>(unreachable, 'stub-anon-key', STUB_CLIENT_OPTIONS);

    const started = Date.now();
    await assert.rejects(
      () => loadPublicBento(offline, 'dark_hifus'),
      (error: Error & { status?: number }) => {
        assert.match(error.message, /Public bento load failed/);
        assert.equal(error.status, 0);
        return true;
      },
    );
    assert.ok(Date.now() - started < 500, `${Date.now() - started} ms : réessai caché ?`);
  });

  /** L'autre réessai caché de `postgrest-js` : un 503 est retenté après une seconde. */
  it('rend un 503 dès la première réponse, sans le retenter', async () => {
    reset();
    stub.enqueue({ message: 'schema cache', code: 'PGRST002', details: null, hint: null }, 503);
    stub.enqueue([rowFor('dark_hifus')]);

    await assert.rejects(
      () => loadPublicBento(client, 'dark_hifus'),
      (error: Error & { status?: number }) => error.status === 503,
    );
    assert.equal(stub.requests.length, 1);

    // La réponse piège, qu'un réessai aurait reçue, attend encore dans la
    // file : la consommer ici, sans quoi elle fausserait le test suivant.
    assert.equal((await loadPublicBento(client, 'dark_hifus'))?.pseudo, 'dark_hifus');
  });
});

/**
 * Chantier 16 : `/u/<pseudo>/<slug>` vise un bento nommé. Le filtre part sur
 * la ressource imbriquée, comme celui des brouillons, pour que la distinction
 * « pseudo inconnu » contre « rien à cette adresse » survive.
 */
describe('loadPublicBento, un bento nommé', () => {
  it('ne filtre pas le slug en base : les autres bentos servent à naviguer', async () => {
    reset();
    stub.enqueue([rowFor('dark_hifus')]);
    await loadPublicBento(client, 'dark_hifus', { slug: 'hebdo-38' });

    const { params } = onlyRequest();
    assert.equal(params.get('bentos.slug'), null, 'le choix se fait au mapping');
    assert.equal(params.get('slug'), null, 'et surtout pas sur `users`');
    assert.equal(params.get('bentos.published_at'), 'not.is.null', 'le brouillon reste exclu');
  });

  it('ne demande rien pour un slug hors format', async () => {
    reset();
    // Vide, majuscules, tiret en tête, tiret en queue, trop court : la
    // contrainte `bentos_slug_format` refuserait chacun d'eux en base.
    for (const slug of ['', 'A-Majuscule', '-tiret-en-tete', 'tiret-en-queue-', 'ok']) {
      assert.equal(await loadPublicBento(client, 'dark_hifus', { slug }), null, slug);
    }
    assert.equal(stub.requests.length, 0, 'aucune requête ne doit partir');
  });

  it('rend « rien à cette adresse » pour un slug inconnu, jamais le principal', async () => {
    reset();
    stub.enqueue([rowFor('dark_hifus')]);
    const result = await loadPublicBento(client, 'dark_hifus', { slug: 'jamais-publie' });
    assert.equal(result?.bento, null, 'ne doit pas retomber sur le principal');
    assert.deepEqual(
      result?.others.map((o) => o.slug),
      [],
      'sans bento choisi, rien à lister',
    );
  });
});
