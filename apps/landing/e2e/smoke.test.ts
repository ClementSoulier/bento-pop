import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { startStub } from './stub';

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

const ENV = {
  ...process.env,
  NEXT_DIST_DIR: DIST_DIR,
  NEXT_PUBLIC_MOBILE_SUPABASE_URL: STUB_URL,
  MOBILE_SUPABASE_ANON_KEY: ANON_KEY,
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
  it('ne laisse pas fuiter la clé anon dans le HTML', async () => {
    for (const route of ['/u/keremasan', '/u/brouillon', '/u/inconnu404']) {
      const html = await (await get(route)).text();
      assert.ok(!html.includes(ANON_KEY), `clé anon présente dans ${route}`);
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
