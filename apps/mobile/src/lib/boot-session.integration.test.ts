import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { makeSession, memoryStorage, startGotrueStub, type GotrueStub } from '../test/gotrue-stub';
import {
  DEVICE_ACCOUNT_KEY,
  authStorageKey,
  bootSession,
  parseDeviceAccount,
  parseStoredSession,
  serializeDeviceAccount,
  type DeviceAccount,
} from './boot-session';
import { withTimeout } from './with-timeout';

/**
 * Le lancement, chantier 28 (D5, D6), avec le vrai `supabase-js` contre un
 * bouchon de GoTrue. Le délai de l'app, 8 secondes, devient 150 ms, et le
 * renouvellement lent du bouchon 600 ms : la même course, quarante fois plus
 * vite.
 */

const OLD = { id: '0b7c6d5e-4f3a-4b2c-8d1e-0f9a8b7c6d5e', is_anonymous: true };
const TIMEOUT = 150;
const SLOW = 600;

let stub: GotrueStub;
const clients: SupabaseClient[] = [];

before(async () => {
  stub = await startGotrueStub({ refreshUser: OLD });
});

beforeEach(() => {
  stub.requests.length = 0;
  stub.signups.length = 0;
  stub.refresh = { kind: 'ok', delayMs: 0 };
});

/**
 * Chaque client arrête son renouvellement automatique une fois son
 * initialisation finie, bouchon encore ouvert : arrêté avant, `auth-js` le
 * relance à la fin de l'initialisation ; bouchon fermé avant, il réessaie
 * sans fin de renouveler contre un port mort.
 */
after(async () => {
  for (const client of clients) {
    await client.auth.initialize();
    await client.auth.stopAutoRefresh();
  }
  await stub.close();
});

/** Un téléphone : son stockage, et le client que l'app crée au démarrage. */
function phone({ stored, device }: { stored?: object; device?: DeviceAccount } = {}) {
  const storage = memoryStorage();
  const key = authStorageKey(stub.url);
  if (stored) storage.items.set(key, JSON.stringify(stored));
  if (device) storage.items.set(DEVICE_ACCOUNT_KEY, serializeDeviceAccount(device));
  const client = createClient(stub.url, 'cle-anon-de-test', {
    auth: { storage, storageKey: key, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    realtime: { transport: class {} as never },
  });
  clients.push(client);
  const deps = {
    auth: client.auth,
    readStoredSession: async () => parseStoredSession((await storage.getItem(key)) ?? null),
    readDeviceAccount: async () => parseDeviceAccount((await storage.getItem(DEVICE_ACCOUNT_KEY)) ?? null),
    timeoutMs: TIMEOUT,
  };
  const storedUser = () => parseStoredSession(storage.items.get(key) ?? null)?.userId ?? null;
  return { client, deps, storedUser };
}

const refreshes = () => stub.requests.filter((r) => r.path === '/auth/v1/token').length;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('le lancement d’avant le chantier 28', () => {
  /**
   * Les lignes 58 à 76 de `session.ts` d'avant, recopiées telles quelles.
   *
   * Le renouvellement traîne au-delà du délai : l'app crée un compte, l'ouvre,
   * et range sa session à la place de l'ancienne. Ici le renouvellement finit
   * par aboutir et remet l'ancienne session dans le stockage, sous un compte
   * neuf déjà ouvert : l'app et son stockage ne parlent plus du même compte.
   * S'il échoue sur le réseau, l'ancienne ne revient jamais : c'est la perte.
   */
  it('ouvre un compte neuf quand le renouvellement traîne', async () => {
    stub.refresh = { kind: 'ok', delayMs: SLOW };
    const { client, storedUser } = phone({ stored: makeSession(OLD, { expired: true }) });

    const existing = await withTimeout(
      client.auth.getSession().then(({ data }) => data.session),
      TIMEOUT,
      null,
    );
    let session = existing;
    if (!session) {
      const signIn = client.auth.signInAnonymously().then(({ data, error }) => {
        if (error) throw error;
        return data.session;
      });
      session = await withTimeout(signIn, TIMEOUT, null);
    }

    assert.equal(stub.signups.length, 1, 'un compte a été créé');
    assert.equal(session?.user.id, stub.signups[0], "l'app s'ouvre sur le compte neuf");
    assert.equal(storedUser(), stub.signups[0], "sa session a pris la place de l'ancienne");

    await wait(SLOW + 100);
    assert.equal(storedUser(), OLD.id, "le renouvellement remet l'ancienne, sous le compte neuf ouvert");
  });
});

describe('bootSession', () => {
  it('rend la session rangée quand elle est valide, sans renouveler', async () => {
    const { deps } = phone({ stored: makeSession(OLD), device: { userId: OLD.id, email: null } });
    const outcome = await bootSession(deps);
    assert.equal(outcome.kind, 'session');
    assert.equal(outcome.kind === 'session' && outcome.session.user.id, OLD.id);
    assert.equal(refreshes(), 0);
  });

  it('rend la session renouvelée à temps', async () => {
    const { deps } = phone({ stored: makeSession(OLD, { expired: true }), device: { userId: OLD.id, email: null } });
    const outcome = await bootSession(deps);
    assert.equal(outcome.kind, 'session');
    assert.equal(stub.signups.length, 0);
  });

  /** D5 : le défaut d'au-dessus, corrigé. */
  it('ne crée aucun compte quand le renouvellement traîne, et garde le compte', async () => {
    stub.refresh = { kind: 'ok', delayMs: SLOW };
    const { client, deps, storedUser } = phone({
      stored: makeSession(OLD, { expired: true }),
      device: { userId: OLD.id, email: null },
    });
    const events: string[] = [];
    client.auth.onAuthStateChange((event, session) => {
      events.push(`${event}:${session?.user.id ?? 'aucun'}`);
    });

    const outcome = await bootSession(deps);
    assert.deepEqual(outcome, { kind: 'pending', userId: OLD.id });
    assert.equal(stub.signups.length, 0, 'aucun compte créé');

    await wait(SLOW + 100);
    assert.equal(storedUser(), OLD.id);
    assert.ok(
      events.some((e) => e === `TOKEN_REFRESHED:${OLD.id}` || e === `INITIAL_SESSION:${OLD.id}`),
      `le compte arrive par onAuthStateChange : ${events.join(', ')}`,
    );
  });

  /** La première ouverture de la nouvelle version : une session de la 1.1, pas encore de marque. */
  it('attend aussi une session rangée sans marque, celle d’une version d’avant', async () => {
    stub.refresh = { kind: 'ok', delayMs: SLOW };
    const { deps } = phone({ stored: makeSession(OLD, { expired: true }) });
    const outcome = await bootSession(deps);
    assert.deepEqual(outcome, { kind: 'pending', userId: OLD.id });
    assert.equal(stub.signups.length, 0);
  });

  /** D6 : un compte gardé dont la session est refusée pour de bon se retrouve d'un code. */
  it('propose de se reconnecter quand la session d’un compte gardé est refusée', async () => {
    stub.refresh = { kind: 'revoked', delayMs: 0 };
    const { deps, storedUser } = phone({
      stored: makeSession({ ...OLD, is_anonymous: false, email: 'popy@recette.test' }, { expired: true }),
      device: { userId: OLD.id, email: 'popy@recette.test' },
    });
    const outcome = await bootSession(deps);
    assert.deepEqual(outcome, { kind: 'lost', device: { userId: OLD.id, email: 'popy@recette.test' } });
    assert.equal(stub.signups.length, 0, 'aucun compte créé');
    assert.equal(storedUser(), null, 'auth-js a effacé la session refusée');
  });

  /** D6 : un anonyme refusé est perdu, rien ne le retrouve ; un compte neuf le remplace. */
  it('remplace un compte anonyme dont la session est refusée', async () => {
    stub.refresh = { kind: 'revoked', delayMs: 0 };
    const { deps } = phone({
      stored: makeSession(OLD, { expired: true }),
      device: { userId: OLD.id, email: null },
    });
    const outcome = await bootSession(deps);
    assert.equal(outcome.kind, 'created');
    assert.equal(outcome.kind === 'created' && outcome.replacing, OLD.id);
    assert.equal(stub.signups.length, 1);
  });

  it('crée un compte anonyme au premier lancement', async () => {
    const { deps, storedUser } = phone();
    const outcome = await bootSession(deps);
    assert.equal(outcome.kind, 'created');
    assert.equal(outcome.kind === 'created' && outcome.replacing, null);
    assert.equal(storedUser(), stub.signups[0]);
  });

  it('ne rend rien au premier lancement sans réseau', async () => {
    const closed = await startGotrueStub({ refreshUser: OLD });
    await closed.close();
    const storage = memoryStorage();
    const client = createClient(closed.url, 'cle-anon-de-test', {
      auth: { storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      realtime: { transport: class {} as never },
    });
    clients.push(client);
    const outcome = await bootSession({
      auth: client.auth,
      readStoredSession: async () => null,
      readDeviceAccount: async () => null,
      timeoutMs: TIMEOUT,
    });
    assert.deepEqual(outcome, { kind: 'offline' });
  });
});

describe('les clés de l’appareil', () => {
  /**
   * La clé de la session doit rester celle que `supabase-js` calcule seul :
   * une autre clé ferait perdre leur session à tous les téléphones qui
   * passent à la nouvelle version.
   */
  it('authStorageKey rend la clé par défaut de supabase-js', () => {
    for (const url of ['https://ggjgktbcqumfxrixcdyx.supabase.co', 'http://127.0.0.1:54331']) {
      const client = createClient(url, 'cle-anon-de-test', {
        auth: { persistSession: false, autoRefreshToken: false },
        realtime: { transport: class {} as never },
      });
      assert.equal(authStorageKey(url), (client as unknown as { storageKey: string }).storageKey);
    }
  });

  it('parseStoredSession lit l’identifiant, et rien d’illisible', () => {
    assert.deepEqual(parseStoredSession(JSON.stringify(makeSession(OLD))), { userId: OLD.id });
    assert.equal(parseStoredSession(null), null);
    assert.equal(parseStoredSession('pas du json'), null);
    assert.deepEqual(parseStoredSession('{}'), { userId: null });
  });

  it('la marque de l’appareil fait l’aller-retour, et refuse une forme inattendue', () => {
    const device = { userId: OLD.id, email: 'popy@recette.test' };
    assert.deepEqual(parseDeviceAccount(serializeDeviceAccount(device)), device);
    assert.deepEqual(parseDeviceAccount(serializeDeviceAccount({ userId: OLD.id, email: null })), {
      userId: OLD.id,
      email: null,
    });
    assert.equal(parseDeviceAccount('{"email":"x@y.fr"}'), null);
    assert.equal(parseDeviceAccount('nope'), null);
  });
});
