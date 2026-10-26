import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { makeSession, memoryStorage, startGotrueStub, type GotrueStub } from '../test/gotrue-stub';
import type { Database } from '@/supabase/types';
import { accountError } from './account';
import {
  confirmKeepCode,
  confirmSignInCode,
  deleteOwnAccountNow,
  requestKeepCode,
  requestSignInCode,
  type AccountClient,
} from './account-actions';

/**
 * Les appels de garder son compte et de se reconnecter, chantier 28, avec le
 * vrai `supabase-js` contre le bouchon de GoTrue. Ce qu'ils gardent : la forme
 * de chaque requête, celle que la vraie authentification a acceptée dans
 * `scripts/check-account.mjs`, et le refus qui remonte intact.
 */

const ME = { id: '6c5b4a39-2817-4f6e-9d5c-4b3a29180f7e', is_anonymous: true };

let stub: GotrueStub;
let phone: AccountClient;
const storage = memoryStorage();

const OPTIONS = { realtime: { transport: class {} as never } };

before(async () => {
  stub = await startGotrueStub({ refreshUser: ME });
  phone = createClient<Database>(stub.url, 'cle-anon-de-test', {
    ...OPTIONS,
    auth: { storage, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const session = makeSession(ME);
  const { error } = await phone.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (error) throw error;
});

beforeEach(() => {
  stub.requests.length = 0;
  stub.fail.clear();
});

after(() => stub.close());

const body = (path: string) => {
  const request = stub.requests.find((r) => r.path === path);
  return request ? (JSON.parse(request.body || '{}') as Record<string, unknown>) : null;
};

describe('garder son compte', () => {
  it('demande un code pour l’adresse rangée en minuscules, sans espaces', async () => {
    const email = await requestKeepCode(phone, '  Popy@Recette.TEST ');
    assert.equal(email, 'popy@recette.test');
    const request = stub.requests.find((r) => r.path === '/auth/v1/user');
    assert.equal(request?.method, 'PUT');
    assert.equal(body('/auth/v1/user')?.email, 'popy@recette.test');
  });

  it('vérifie le code comme un changement d’adresse', async () => {
    const user = await confirmKeepCode(phone, 'popy@recette.test', '123456');
    assert.equal(user.id, ME.id);
    assert.deepEqual(
      { email: body('/auth/v1/verify')?.email, token: body('/auth/v1/verify')?.token, type: body('/auth/v1/verify')?.type },
      { email: 'popy@recette.test', token: '123456', type: 'email_change' },
    );
  });

  it('laisse remonter le refus d’une adresse déjà gardée', async () => {
    stub.fail.set('/auth/v1/user', {
      status: 422,
      body: { code: 422, error_code: 'email_exists', msg: 'A user with this email address has already been registered' },
    });
    await assert.rejects(
      () => requestKeepCode(phone, 'prise@recette.test'),
      (e) => accountError(e) === 'email-taken',
    );
  });

  it('laisse remonter le refus d’un code faux', async () => {
    stub.fail.set('/auth/v1/verify', {
      status: 403,
      body: { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' },
    });
    await assert.rejects(
      () => confirmKeepCode(phone, 'popy@recette.test', '000000'),
      (e) => accountError(e) === 'wrong-code',
    );
  });
});

describe('se reconnecter', () => {
  /** Sans `create_user: false`, une adresse inconnue ouvrirait un compte vide. */
  it('demande un code sans jamais créer de compte', async () => {
    await requestSignInCode(phone, 'Popy@recette.test');
    assert.equal(body('/auth/v1/otp')?.email, 'popy@recette.test');
    assert.equal(body('/auth/v1/otp')?.create_user, false);
  });

  it('vérifie le code sur un client sans stockage, et rend la session', async () => {
    const signInStorage = memoryStorage();
    const signIn = createClient<Database>(stub.url, 'cle-anon-de-test', {
      ...OPTIONS,
      auth: { storage: signInStorage, persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const before = [...storage.items.entries()];

    const session = await confirmSignInCode(signIn, 'popy@recette.test', '654321');
    assert.equal(session.user.id, ME.id);
    assert.equal(body('/auth/v1/verify')?.type, 'email');
    assert.equal(signInStorage.items.size, 0, 'rien de rangé par le client à part');
    assert.deepEqual([...storage.items.entries()], before, 'la session du téléphone n’a pas bougé');
  });

  it('laisse remonter le refus d’une adresse sans compte', async () => {
    stub.fail.set('/auth/v1/otp', {
      status: 422,
      body: { code: 422, error_code: 'otp_disabled', msg: 'Signups not allowed for otp' },
    });
    await assert.rejects(
      () => requestSignInCode(phone, 'inconnue@recette.test'),
      (e) => accountError(e) === 'no-account',
    );
  });
});

describe('supprimer son compte', () => {
  it('appelle delete_own_account avec la session du téléphone', async () => {
    await deleteOwnAccountNow(phone);
    const request = stub.requests.find((r) => r.path === '/rest/v1/rpc/delete_own_account');
    assert.equal(request?.method, 'POST');
  });
});
