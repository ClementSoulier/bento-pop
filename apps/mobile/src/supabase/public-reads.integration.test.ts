import assert from 'node:assert/strict';
import { createServer, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import {
  createClient,
  type SupabaseClient,
  type SupabaseClientOptions,
} from '@supabase/supabase-js';
import { loadPublicBento } from '../lib/public-bento';
import { STUB_CLIENT_OPTIONS } from '../test/postgrest-stub';
import { PUBLIC_READS_AUTH_OPTIONS } from './public-reads';
import type { Database } from './types';

/**
 * Le client des lectures publiques face à une authentification en panne, le
 * scénario observé sur émulateur Android : une session stockée périmée, et un
 * renouvellement qui répond 503. Vrai `supabase-js`, serveur local.
 *
 * `auth-js` réessaie le renouvellement après 200, 400 puis 800 ms. Le serveur
 * répond 503 trois fois, puis refuse le jeton : le renouvellement s'arrête là
 * au lieu de courir jusqu'à 30 s, et le témoin tient en une seconde et demie.
 *
 * Le stockage de l'app, session périmée comprise, est offert à chaque client.
 * C'est la régression plausible, recopier le bloc `auth` du client principal,
 * et sans lui un client neuf n'aurait de toute façon rien à renouveler.
 */

type AuthOptions = NonNullable<SupabaseClientOptions<'public'>['auth']>;

/** Les options du client principal, `supabase` dans `client.ts`, stockage à part. */
const MAIN_AUTH_OPTIONS = {
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: false,
} as const satisfies AuthOptions;

/**
 * Les pauses d'`auth-js` entre les quatre tentatives font 1,4 s (200 + 400 +
 * 800 ms). Le seuil garde de la marge sur la précision des minuteurs : l'ordre
 * des requêtes prouve déjà l'attente, la durée en montre l'ampleur.
 */
const REFRESH_WAIT_FLOOR_MS = 1000;

type AuthOutage = {
  url: string;
  /** Chemins reçus, dans l'ordre. */
  paths: string[];
  /** Réarme la panne : trois 503 sur le renouvellement, puis le refus. */
  rearm: () => void;
  close: () => Promise<void>;
};

function send(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function startAuthOutage(): Promise<AuthOutage> {
  const paths: string[] = [];
  let tokenStatuses: number[] = [];

  const server: Server = createServer((req, res) => {
    const path = (req.url ?? '').split('?')[0] ?? '';
    req.resume();
    req.on('end', () => {
      paths.push(path);
      if (path !== '/auth/v1/token') {
        send(res, 200, []);
        return;
      }
      const status = tokenStatuses.shift() ?? 400;
      if (status === 400) {
        // Le refus clôt la boucle : `auth-js` ne réessaie que les pannes.
        send(res, 400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token' });
      } else {
        send(res, status, { message: 'Service Unavailable' });
      }
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    paths,
    rearm: () => {
      paths.length = 0;
      tokenStatuses = [503, 503, 503];
    },
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

/** Clé par défaut de `supabase-js`, celle du client principal : `sb-<hôte>-auth-token`. */
function mainStorageKey(url: string): string {
  return `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
}

/** Le stockage de l'app, en mémoire, avec le contrat asynchrone d'AsyncStorage. */
function appStorageWithExpiredSession(url: string) {
  const now = Math.floor(Date.now() / 1000);
  const values = new Map<string, string>([
    [
      mainStorageKey(url),
      JSON.stringify({
        access_token: 'jeton-perime',
        refresh_token: 'jeton-de-renouvellement',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: now - 60,
        user: { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated' },
      }),
    ],
  ]);
  return {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: async (key: string) => {
      values.delete(key);
    },
  };
}

let outage: AuthOutage;
let clients: SupabaseClient<Database>[] = [];

before(async () => {
  outage = await startAuthOutage();
});

after(async () => {
  await outage.close();
});

beforeEach(() => {
  outage.rearm();
});

afterEach(async () => {
  for (const client of clients) await client.auth.stopAutoRefresh();
  clients = [];
});

/**
 * Crée le client puis lit une page publique. Le chronomètre part de la
 * création : c'est elle qui lance la reprise de session stockée.
 */
async function timedPublicRead(auth: AuthOptions): Promise<number> {
  const started = Date.now();
  const client = createClient<Database>(outage.url, 'stub-anon-key', {
    ...STUB_CLIENT_OPTIONS,
    auth,
  });
  clients.push(client);
  await loadPublicBento(client, 'dark_hifus');
  return Date.now() - started;
}

describe('lecture publique, authentification en panne', () => {
  it('témoin : avec les options du client principal, la lecture attend le renouvellement', async (t) => {
    // `auth-js` rapporte l'échec du renouvellement au démarrage par console.error.
    t.mock.method(console, 'error', () => {});
    const storage = appStorageWithExpiredSession(outage.url);

    const elapsed = await timedPublicRead({ ...MAIN_AUTH_OPTIONS, storage });

    assert.deepEqual(outage.paths, [
      '/auth/v1/token',
      '/auth/v1/token',
      '/auth/v1/token',
      '/auth/v1/token',
      '/rest/v1/users',
    ]);
    assert.ok(elapsed >= REFRESH_WAIT_FLOOR_MS, `${elapsed} ms`);
  });

  it('le client des lectures publiques lit sans attendre, et sans appeler l’authentification', async () => {
    const storage = appStorageWithExpiredSession(outage.url);

    const elapsed = await timedPublicRead({ storage, ...PUBLIC_READS_AUTH_OPTIONS });

    assert.deepEqual(outage.paths, ['/rest/v1/users']);
    assert.ok(elapsed < 300, `${elapsed} ms`);
  });
});

/**
 * Les deux protections du client sont redondantes : chacune suffit. Sans ces
 * cas, en retirer une passerait inaperçu, et l'autre resterait seule.
 */
describe('lecture publique, chaque protection tient seule', () => {
  it('sans persistance, la session stockée n’est pas lue, même sous la clé du client principal', async () => {
    const storage = appStorageWithExpiredSession(outage.url);

    const elapsed = await timedPublicRead({
      storage,
      ...PUBLIC_READS_AUTH_OPTIONS,
      storageKey: mainStorageKey(outage.url),
    });

    assert.deepEqual(outage.paths, ['/rest/v1/users']);
    assert.ok(elapsed < 300, `${elapsed} ms`);
  });

  it('même persistée, la session lue serait la sienne, pas celle du client principal', async () => {
    const storage = appStorageWithExpiredSession(outage.url);

    const elapsed = await timedPublicRead({
      storage,
      ...PUBLIC_READS_AUTH_OPTIONS,
      persistSession: true,
    });

    assert.deepEqual(outage.paths, ['/rest/v1/users']);
    assert.ok(elapsed < 300, `${elapsed} ms`);
  });
});
