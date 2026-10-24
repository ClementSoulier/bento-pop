import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { readFileSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { bentoId, startStub, type EpisodeQuery, type VisitCall } from './stub';

/**
 * Tests d'intégration HTTP de la page bento publique.
 *
 * Le montage exerce la chaîne réelle : vrai client Supabase, vrai serveur
 * Next construit en mode production, vrai rendu, vraie génération d'image.
 * Seul PostgREST est bouchonné, au niveau du protocole (cf. `stub.mjs`).
 *
 * Ports figés : `NEXT_PUBLIC_MOBILE_SUPABASE_URL` est inlinée au build, on
 * ne peut donc pas tirer un port au hasard après coup.
 */

const STUB_PORT = 4599;
const APP_PORT = 4598;
const STUB_URL = `http://127.0.0.1:${STUB_PORT}`;
const APP_URL = `http://127.0.0.1:${APP_PORT}`;
const SITE_URL = 'https://bento-pop.test';
const DIST_DIR = '.next-e2e';
const ANON_KEY = 'cle-anon-de-test-ne-doit-jamais-fuiter';
const VISIT_SECRET = 'secret-de-visite-ne-doit-jamais-fuiter';
/** La clé du Supabase de la landing, publique par nature : `NEXT_PUBLIC_`. */
const LANDING_ANON_KEY = 'cle-anon-landing-de-test';

const ENV = {
  ...process.env,
  NEXT_DIST_DIR: DIST_DIR,
  NEXT_PUBLIC_MOBILE_SUPABASE_URL: STUB_URL,
  MOBILE_SUPABASE_ANON_KEY: ANON_KEY,
  // Le Supabase de la landing, sur le même bouchon depuis le chantier 19,
  // pour `/api/episodes`. Il ne sert que la sélection de cette route : le
  // reste de la landing garde son repli, comme sans base.
  NEXT_PUBLIC_SUPABASE_URL: STUB_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: LANDING_ANON_KEY,
  BENTO_VISIT_SECRET: VISIT_SECRET,
  NEXT_PUBLIC_SITE_URL: SITE_URL,
  NEXT_TELEMETRY_DISABLED: '1',
};

let stub: Awaited<ReturnType<typeof startStub>>;
let app: ChildProcess;

function run(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('node_modules/.bin/next', args, { env: ENV, stdio: 'pipe' });
    let output = '';
    child.stdout?.on('data', (d) => (output += d));
    child.stderr?.on('data', (d) => (output += d));
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`next ${args[0]} a échoué :\n${output}`)),
    );
  });
}

async function waitForApp(): Promise<void> {
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(`${APP_URL}/u/keremasan`);
      if (res.status < 500) return;
    } catch {
      // Le serveur n'écoute pas encore.
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("le serveur Next n'a jamais répondu");
}

const stubStats = () => fetch(`${STUB_URL}/__stats`).then((r) => r.json() as Promise<{ requests: number }>);
const resetStub = () => fetch(`${STUB_URL}/__reset`);
const breakStub = () => fetch(`${STUB_URL}/__fail`);

/** `redirect: 'manual'` : sinon `fetch` suit la 308 et masque le code. */
const get = (path: string) => fetch(`${APP_URL}${path}`, { redirect: 'manual' });

before(async () => {
  stub = await startStub(STUB_PORT);
  // Un dossier neuf à chaque lancement : `next build` y laisse les pages que
  // `next start` a rendues à la demande la fois d'avant, et une page restée
  // d'un ancien rendu masquerait une régression. Vu au chantier 20.
  rmSync(DIST_DIR, { recursive: true, force: true });
  await run(['build']);
  app = spawn('node_modules/.bin/next', ['start', '--port', String(APP_PORT)], {
    env: ENV,
    stdio: 'pipe',
  });
  await waitForApp();
}, { timeout: 300_000 });

after(async () => {
  app?.kill();
  await new Promise<void>((resolve) => stub.close(() => resolve()));
});

describe('codes de statut', () => {
  it('sert un bento publié', async () => {
    const res = await get('/u/keremasan');
    assert.equal(res.status, 200);
  });

  it('renvoie 404 sur un pseudo inconnu', async () => {
    // Et pas 200 avec un message : un 200 se ferait indexer et fausserait
    // toute mesure d'audience.
    assert.equal((await get('/u/inconnu404')).status, 404);
  });

  /**
   * Pseudos réservés à ce test. Sur un système de fichiers insensible à la
   * casse (macOS en développement), le cache ISR ne distingue pas
   * `/u/MaJuScUlE` de `/u/majuscule` : viser ici un pseudo utilisé par un
   * autre test le ferait échouer de façon dépendante de l'ordre. Sous
   * Linux, en CI comme en production, le problème n'existe pas.
   */
  it('redirige en 308 vers l’URL en minuscules', async () => {
    for (const [requested, expected] of [
      ['/u/MaJuScUlE', '/u/majuscule'],
      ['/u/INEXISTANT-CASSE', '/u/inexistant-casse'],
    ]) {
      const res = await get(requested!);
      assert.equal(res.status, 308, `attendu 308 pour ${requested}`);

      // Next émet deux en-têtes `Location` identiques lors d'une
      // génération à la demande, et `Headers.get` les concatène. On
      // vérifie donc qu'il n'y a qu'une seule cible distincte.
      const targets = [...new Set((res.headers.get('location') ?? '').split(', '))];
      assert.deepEqual(targets, [expected]);
    }
  });

  it('sert directement l’URL canonique, sans redirection', async () => {
    const res = await get('/u/keremasan');
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('location'), null);
  });

  /**
   * Non-régression de sécurité. `_` est autorisé par la contrainte SQL sur
   * `pseudo` et reste le joker « un caractère » d'ILIKE : `buyt_k` matche
   * `buyt.k` côté base. Sans la vérification d'égalité exacte, cette URL
   * servirait le bento de quelqu'un d'autre.
   */
  it("ne sert pas le bento d'autrui via le joker underscore", async () => {
    const res = await get('/u/buyt_k');
    assert.equal(res.status, 404);
  });

  it('renvoie 200 sur un profil sans bento publié', async () => {
    assert.equal((await get('/u/brouillon')).status, 200);
  });
});

describe('validation avant requête', () => {
  it('rejette les pseudos malformés sans interroger la base', async () => {
    await resetStub();
    const before = (await stubStats()).requests;

    for (const bad of ['%25', 'ab', 'a'.repeat(21), 'kerem-asan', 'kerem%20asan']) {
      assert.equal((await get(`/u/${bad}`)).status, 404, `attendu 404 pour « ${bad} »`);
    }

    const after = (await stubStats()).requests;
    assert.equal(after, before, `${after - before} requête(s) déclenchée(s) par une URL invalide`);
  });
});

describe('contenu rendu', () => {
  it('affiche les six choix et le pseudo', async () => {
    const html = await (await get('/u/keremasan')).text();
    for (const title of ['Interstellar', 'Severance', 'Orelsan', 'La Quete', 'Squeezie', 'Japan Expo']) {
      assert.ok(html.includes(title), `titre absent : ${title}`);
    }
    // La casse choisie par l'utilisateur reste affichée, seule l'URL
    // est normalisée.
    assert.ok(html.includes('@Keremasan'), 'la casse stockée doit rester affichée');
  });

  it('rend une case vide quand la RLS masque l’item, sans « undefined »', async () => {
    const html = await (await get('/u/rejete')).text();
    assert.equal((await get('/u/rejete')).status, 200);
    assert.ok(html.includes('Interstellar'), 'les autres cases doivent rester');
    assert.ok(!/>undefined</.test(html), '« undefined » rendu dans la page');
    assert.ok(!/>null</.test(html), '« null » rendu dans la page');
  });

  it('affiche l’écran « pas encore terminé » sans divulguer de contenu', async () => {
    const html = await (await get('/u/brouillon')).text();
    assert.ok(html.includes("pas encore terminé"), 'message absent');
    assert.ok(!html.includes('Interstellar'), 'un titre a fuité sur un bento non publié');
  });
});

describe('métadonnées', () => {
  const meta = (html: string, key: string) =>
    new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`).exec(html)?.[1];

  it('expose des balises de partage complètes et absolues', async () => {
    const html = await (await get('/u/keremasan')).text();

    assert.equal(meta(html, 'og:title'), 'Le bento de @Keremasan');
    assert.ok(meta(html, 'og:description')?.includes('Interstellar'));
    assert.equal(meta(html, 'og:url'), `${SITE_URL}/u/keremasan`);
    assert.equal(meta(html, 'twitter:card'), 'summary_large_image');

    for (const key of ['og:image', 'twitter:image']) {
      const url = meta(html, key);
      assert.ok(url?.startsWith(`${SITE_URL}/`), `${key} n'est pas absolue : ${url}`);
    }
  });

  it('n’indexe que les bentos mis en avant', async () => {
    const featured = await (await get('/u/keremasan')).text();
    const ordinary = await (await get('/u/buyt.k')).text();
    const draft = await (await get('/u/brouillon')).text();

    assert.equal(meta(featured, 'robots'), 'index, follow');
    assert.equal(meta(ordinary, 'robots'), 'noindex, follow');
    // Une page 200 sans contenu réel serait lue comme un « soft 404 ».
    assert.equal(meta(draft, 'robots'), 'noindex, follow');
  });

  it('n’indexe pas un bento mis en avant dont le compte s’est retiré de la recherche', async () => {
    const res = await get('/u/retire.recherche');
    assert.equal(res.status, 200);
    assert.equal(meta(await res.text(), 'robots'), 'noindex, follow');
  });

  it('sort du sitemap un compte retiré de la recherche, mis en avant ou non', async () => {
    const xml = await (await get('/sitemap.xml')).text();
    // La casse stockée, celle des adresses du sitemap.
    assert.ok(xml.includes(`${SITE_URL}/u/Keremasan`), xml);
    assert.ok(!xml.includes('/u/retire.recherche'), xml);
  });

  it('rend la page quand la base ne connaît pas encore le réglage (avant sa migration)', async () => {
    await fetch(`${STUB_URL}/__avant-20`);
    try {
      const res = await get('/u/avant.vingt');
      assert.equal(res.status, 200);
      assert.ok((await res.text()).includes('Interstellar'));
    } finally {
      await resetStub();
    }
  });

  /**
   * Un bento invité est composé par l'équipe pour un créateur rencontré hors
   * de l'app, et il est presque toujours aussi mis en avant. Les deux
   * pastilles ne peuvent pas coexister sur le même Popy, et c'est « Invité »
   * qui doit gagner : « à la une » est un avis qui se devine, alors que
   * l'origine du contenu ne se déduit de rien. Sans elle, la page attribue à
   * une personne réelle une composition qu'elle n'a pas faite.
   */
  it('affiche « Invité » plutôt que « À la une » sur un bento éditorial', async () => {
    const guest = await (await get('/u/invite')).text();
    assert.ok(guest.includes('Invité'), 'la pastille invité manque');
    assert.ok(!guest.includes('À la une'), 'les deux pastilles s’affichent en même temps');
    assert.ok(guest.includes('Créateur Invité'), 'le nom affiché manque');
  });

  it('garde « À la une » sur un bento de membre mis en avant', async () => {
    const featured = await (await get('/u/keremasan')).text();
    assert.ok(featured.includes('À la une'));
    assert.ok(!featured.includes('>Invité<'), 'un membre ne doit pas être marqué invité');
  });

  it('déclare la bannière Smart App iOS', async () => {
    const html = await (await get('/u/keremasan')).text();
    assert.match(meta(html, 'apple-itunes-app') ?? '', /^app-id=\d+, app-argument=https:\/\//);
  });

  it('déclare une URL canonique', async () => {
    const html = await (await get('/u/keremasan')).text();
    assert.match(html, new RegExp(`<link rel="canonical" href="${SITE_URL}/u/keremasan"`));
  });
});

describe('image Open Graph', () => {
  it('sert un JPEG valide de 1200×630 dans le budget', async () => {
    const res = await fetch(`${APP_URL}/u/keremasan/opengraph-image/bento`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/jpeg');

    const bytes = Buffer.from(await res.arrayBuffer());
    assert.deepEqual([...bytes.subarray(0, 3)], [0xff, 0xd8, 0xff], 'en-tête JPEG absent');
    assert.ok(bytes.byteLength < 300 * 1024, `${Math.round(bytes.byteLength / 1024)} Ko`);
    assert.deepEqual(jpegSize(bytes), { width: 1200, height: 630 });
  });

  it('sert aussi l’image Twitter', async () => {
    const res = await fetch(`${APP_URL}/u/keremasan/twitter-image/bento`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/jpeg');
  });
});

describe('sécurité et poids', () => {
  it('ne laisse pas fuiter la clé anon ni le secret des visites dans le HTML', async () => {
    for (const route of ['/u/keremasan', '/u/brouillon', '/u/inconnu404']) {
      const html = await (await get(route)).text();
      assert.ok(!html.includes(ANON_KEY), `clé anon présente dans ${route}`);
      assert.ok(!html.includes(VISIT_SECRET), `secret des visites présent dans ${route}`);
    }
  });

  it('tient le budget de poids du HTML', async () => {
    const html = await (await get('/u/keremasan')).text();
    const gzipped = gzipSync(Buffer.from(html)).byteLength;
    assert.ok(gzipped < 60 * 1024, `${Math.round(gzipped / 1024)} Ko compressés`);
  });

  /**
   * Aucun composant client propre au segment : ses fragments JavaScript
   * doivent tous provenir de la mise en page commune, partagée avec les
   * autres pages du site.
   */
  it('n’ajoute aucun fragment JavaScript propre à la page', async () => {
    const manifest = JSON.parse(
      readFileSync(path.join(process.cwd(), DIST_DIR, 'app-build-manifest.json'), 'utf8'),
    ) as { pages: Record<string, string[]> };

    // Chaque route reçoit son propre fichier `page-*.js`, ne serait-ce que
    // pour référencer les composants clients partagés : comparer les noms
    // n'aurait aucun sens. C'est le POIDS qui dit s'il y a du code client
    // en plus, et la référence est une page de contenu comparable.
    const weight = (route: string) =>
      (manifest.pages[route] ?? [])
        .filter((chunk) => chunk.endsWith('.js'))
        .reduce((total, chunk) => total + statSync(path.join(process.cwd(), DIST_DIR, chunk)).size, 0);

    const own = weight('/u/[pseudo]/page');
    const control = weight('/mentions-legales/page');

    assert.ok(own > 0, 'manifeste illisible');
    assert.ok(
      own <= control,
      `${Math.round(own / 1024)} Ko contre ${Math.round(control / 1024)} Ko pour la page de référence`,
    );
  });
});

describe('structure accessible', () => {
  it('a un seul h1, une langue déclarée, et aucune image sans alt', async () => {
    const html = await (await get('/u/keremasan')).text();

    assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, 'il faut exactement un <h1>');
    assert.ok(html.includes('<html lang="fr"'), 'langue du document absente');

    const withoutAlt = (html.match(/<img\b[^>]*>/g) ?? []).filter((tag) => !tag.includes('alt='));
    assert.deepEqual(withoutAlt, [], 'image sans attribut alt');
  });
});

describe('résilience', () => {
  /**
   * Base injoignable : la page doit répondre 404 proprement, pas une 500
   * avec une trace. Les robots d'aperçu ne réessaient pas sur une 500, et
   * une page d'erreur Next divulguerait la structure interne.
   */
  it('dégrade proprement quand la base est en panne', async () => {
    await breakStub();
    const res = await get('/u/jamais-vu-avant');

    assert.equal(res.status, 404);
    const html = await res.text();
    assert.ok(!html.includes('at async'), 'trace d’exécution divulguée');
    assert.ok(!/Internal Server Error/i.test(html));
    await resetStub();
  });
});

/**
 * Chantier 8. Le bouchon rend 47 visites pour `Keremasan`, zéro pour
 * `buyt.k`, et nul pour `invite`, dont le propriétaire masque ses visites.
 * L'image de comptage se demande ici comme un navigateur derrière le proxy
 * de Coolify : avec un navigateur et un `X-Forwarded-For`.
 */
describe('compteur de visites', () => {
  const BROWSER =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';
  const pixel = (query: string, headers: Record<string, string> = {}) =>
    fetch(`${APP_URL}/api/bento-opened${query}`, {
      headers: { 'user-agent': BROWSER, 'x-forwarded-for': '203.0.113.9', ...headers },
    });
  const visitCalls = () => fetch(`${STUB_URL}/__visits`).then((r) => r.json() as Promise<VisitCall[]>);

  it('affiche le compteur à côté de la date, zéro compris', async () => {
    const html = await (await get('/u/keremasan')).text();
    assert.ok(html.includes('>47\u00a0visites<'), 'compteur absent');
    const zero = await (await get('/u/buyt.k')).text();
    assert.ok(zero.includes('>0\u00a0visite<'), '« 0 visite » doit s’afficher');
  });

  it('n’affiche rien quand le propriétaire masque ses visites', async () => {
    const html = await (await get('/u/invite')).text();
    assert.ok(!/\d\u00a0visites?</.test(html), 'un compteur masqué s’affiche');
  });

  it('compte la visite par une image, sans JavaScript', async () => {
    const html = await (await get('/u/keremasan')).text();
    // Le jour dans l'adresse, que React échappe en `&amp;` : sans lui, Safari
    // ressert l'image de la veille sans la redemander.
    assert.match(
      html,
      new RegExp(`src="/api/bento-opened\\?b=${bentoId(1)}&amp;d=\\d{4}-\\d{2}-\\d{2}"`),
      'image de comptage absente, ou sans le jour',
    );

    await resetStub();
    const res = await pixel(`?b=${bentoId(1)}&d=2026-10-23`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/gif');
    assert.match(res.headers.get('cache-control') ?? '', /no-store/);
    assert.equal(res.headers.get('x-bento-visit'), 'recorded');
    assert.deepEqual(await visitCalls(), [
      { p_bento: bentoId(1), p_fingerprint: `203.0.113.9|${BROWSER}`, p_secret: VISIT_SECRET },
    ]);
  });

  it('n’interroge pas la base pour un robot, un préchargement ou une adresse malformée', async () => {
    await resetStub();
    for (const [query, headers, expected] of [
      [`?b=${bentoId(1)}`, { 'user-agent': 'facebookexternalhit/1.1' }, 'bot'],
      [`?b=${bentoId(1)}`, { 'sec-purpose': 'prefetch;prerender' }, 'prefetch'],
      ['?b=b-1', {}, 'invalid'],
      ['', {}, 'invalid'],
    ] as const) {
      const res = await pixel(query, headers);
      assert.equal(res.headers.get('x-bento-visit'), expected, `${query} ${JSON.stringify(headers)}`);
      // La même image dans tous les cas : jamais d'image cassée chez le visiteur.
      assert.equal(res.headers.get('content-type'), 'image/gif');
    }
    assert.equal((await stubStats()).requests, 0);
  });
});

/** Lit les dimensions dans le marqueur SOF d'un JPEG. */
function jpegSize(buffer: Buffer): { width: number; height: number } | null {
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1]!;
    const length = buffer.readUInt16BE(offset + 2);
    // SOF0 à SOF15, hors marqueurs non liés à la trame.
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  return null;
}

/**
 * Chantier 16. Le compte `deuxbentos` du bouchon rend sa relation en
 * TABLEAU, la forme que PostgREST prend une fois `bentos_user_id_key` levée,
 * et porte deux bentos publiés : `mon-bento`, principal, et `hebdo-38`.
 */
describe('plusieurs bentos par compte', () => {
  it('sert toujours le bento principal à l’adresse du compte', async () => {
    const res = await get('/u/deuxbentos');
    assert.equal(res.status, 200);
    const html = await res.text();
    // `hebdo-38` est publié en février, `mon-bento` en décembre : si le choix
    // se faisait sur « le premier venu » ou sur la date, ce test tomberait.
    assert.ok(html.includes('/u/deuxbentos/hebdo-38'), 'le second doit être accessible');
  });

  it('donne au second bento sa propre adresse', async () => {
    const res = await get('/u/deuxbentos/hebdo-38');
    assert.equal(res.status, 200);
    assert.ok((await res.text()).includes('@deuxbentos'));
  });

  it('renvoie 404 sur une adresse de bento qui n’existe pas', async () => {
    // Et surtout pas le bento principal : un lien mort ne doit pas afficher
    // silencieusement autre chose que ce qu'il nomme.
    assert.equal((await get('/u/deuxbentos/jamais-publie')).status, 404);
  });

  it('canonise le second bento sur sa propre adresse', async () => {
    const html = await (await get('/u/deuxbentos/hebdo-38')).text();
    assert.ok(
      html.includes(`${SITE_URL}/u/deuxbentos/hebdo-38`),
      'la canonique doit nommer le bento',
    );
  });

  it('canonise le principal sur l’adresse du compte, même servi sous son slug', async () => {
    const res = await get('/u/deuxbentos/mon-bento');
    assert.equal(res.status, 200);
    const html = await res.text();
    // Deux URL pour un même contenu se départagent par la canonique, et c'est
    // l'adresse du compte qui gagne : c'est elle qui circule déjà.
    assert.ok(html.includes(`${SITE_URL}/u/deuxbentos"`), 'la canonique doit être celle du compte');
    assert.ok(
      !html.includes(`${SITE_URL}/u/deuxbentos/mon-bento"`),
      'et surtout pas celle sous le slug',
    );
  });

  it('ne montre aucune autre adresse à un compte qui n’a qu’un bento', async () => {
    // `/u/<pseudo>/opengraph-image/...` existe de toute façon : c'est la
    // navigation entre bentos qui ne doit pas apparaître.
    const seul = await (await get('/u/keremasan')).text();
    assert.ok(!seul.includes('Les autres bentos de ce compte'), 'rien ne doit changer pour eux');

    const plusieurs = await (await get('/u/deuxbentos')).text();
    assert.ok(plusieurs.includes('Les autres bentos de ce compte'), 'témoin du même test');
  });
});

/**
 * Chantier 19 : les épisodes que l'app range dans « La table ». Le bouchon
 * rend aussi un épisode programmé et un épisode sans date, sans filtrer :
 * c'est à la route de les écarter, et elle doit aussi demander à la base le
 * filtre du catalogue.
 */
describe('épisodes pour l’app', () => {
  type Episode = Record<string, unknown> & { id: string };
  const episodes = async () => ((await (await get('/api/episodes')).json()) as { episodes: Episode[] }).episodes;
  const episodeQueries = () => fetch(`${STUB_URL}/__episodes`).then((r) => r.json() as Promise<EpisodeQuery[]>);

  it('rend les épisodes publiés du plus récent au plus ancien, sans programmé ni épisode sans date', async () => {
    await resetStub();
    const res = await get('/api/episodes');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /application\/json/);
    assert.equal(res.headers.get('cache-control'), 'public, max-age=60, s-maxage=60, stale-while-revalidate=300');
    const { episodes: list } = (await res.json()) as { episodes: Episode[] };
    assert.deepEqual(
      list.map((e) => e.id),
      ['show-1', 'podcast-1', 'show-2', 'podcast-a-remplacer', 'podcast-2', 'podcast-3'],
    );
  });

  it('ouvre sur le site un podcast que sa plateforme n’a pas encore repris', async () => {
    const byId = Object.fromEntries((await episodes()).map((e) => [e.id, e]));
    assert.equal(byId['podcast-a-remplacer']?.platform, 'site');
    assert.equal(byId['podcast-a-remplacer']?.openUrl, `${SITE_URL}/podcasts/ambiance-tokyo-a-la-maison`);
  });

  it('ouvre YouTube pour une émission, la plateforme du podcast pour un podcast', async () => {
    const byId = Object.fromEntries((await episodes()).map((e) => [e.id, e]));
    assert.equal(byId['show-1']?.openUrl, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    assert.equal(byId['show-1']?.thumbnailUrl, 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
    assert.equal(byId['show-2']?.thumbnailUrl, 'https://cdn.bento-pop.test/miniature.jpg');
    assert.equal(byId['podcast-1']?.openUrl, 'https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk');
    assert.equal(byId['podcast-2']?.openUrl, 'https://podcasts.apple.com/fr/podcast/id1234567890?i=1000650000001');
    assert.equal(byId['podcast-3']?.openUrl, 'https://www.deezer.com/episode/700000001');
  });

  it('demande à la base les seuls épisodes publiés, sans date ou à date passée', async () => {
    await resetStub();
    const before = Date.now();
    await get('/api/episodes');
    const after = Date.now();
    const queries = await episodeQueries();
    assert.deepEqual(queries.map((q) => q.table).sort(), ['landing_podcast_episodes', 'landing_show_episodes']);
    for (const q of queries) {
      assert.deepEqual(q.params.status, ['eq.published'], q.table);
      const or = q.params.or?.[0] ?? '';
      const at = or.match(/^\(published_at\.is\.null,published_at\.lte\.(.+)\)$/)?.[1];
      assert.ok(at, `${q.table} : filtre de visibilité absent, « ${or} »`);
      // L'heure de la requête, et non une heure figée au démarrage du serveur.
      const time = Date.parse(at);
      assert.ok(time >= before - 1000 && time <= after + 1000, `${q.table} : filtre daté du ${at}`);
    }
  });

  it('répond 503 sans cache quand la base ne répond pas', async () => {
    await breakStub();
    const res = await get('/api/episodes');
    assert.equal(res.status, 503);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    await resetStub();
  });
});
