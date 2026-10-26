import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * Bouchon de l'authentification de Supabase (GoTrue), pour les tests du
 * lancement, chantier 28.
 *
 * Même principe que `postgrest-stub.ts` : on bouchonne le **protocole**, et
 * le vrai `@supabase/supabase-js` parle au bouchon par le réseau local. Ce
 * qu'on veut éprouver vit dans `auth-js` : l'attente du renouvellement, ses
 * réessais, ce qu'il range et ce qu'il efface. Un faux client n'aurait rien
 * prouvé de tout ça.
 *
 * Les routes du lancement (renouveler une session, créer un compte anonyme,
 * lire le compte) et celles de garder son compte et de se reconnecter
 * (`PUT /user`, `/otp`, `/verify`), plus les fonctions SQL, qui répondent 204. Ce fichier ne se termine pas par
 * `.test.ts`, il n'est donc pas ramassé par le glob de `pnpm test`.
 */

export type GotrueRequest = { method: string; path: string; query: string; body: string };

/**
 * Ce que répond le renouvellement :
 *   - `ok` : une session neuve pour le même compte, après `delayMs` ;
 *   - `revoked` : le refus définitif de GoTrue, 400 `refresh_token_not_found`,
 *     que `auth-js` sanctionne en effaçant la session.
 */
export type RefreshMode = { kind: 'ok' | 'revoked'; delayMs: number };

export type GotrueStub = {
  url: string;
  requests: GotrueRequest[];
  refresh: RefreshMode;
  /** Les comptes anonymes créés par `/signup`, dans l'ordre. */
  signups: string[];
  /** Une réponse d'erreur imposée à une route, le temps d'un test. */
  fail: Map<string, { status: number; body: unknown }>;
  close: () => Promise<void>;
};

const HOUR = 3600;

/** Un JWT bien formé ; personne ne vérifie sa signature dans ces tests. */
function fakeJwt(sub: string, exp: number, isAnonymous: boolean): string {
  const part = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${part({ alg: 'HS256', typ: 'JWT' })}.${part({
    sub,
    exp,
    role: 'authenticated',
    aud: 'authenticated',
    is_anonymous: isAnonymous,
  })}.${Buffer.from('signature-de-test').toString('base64url')}`;
}

export type StubUser = { id: string; email?: string | null; is_anonymous: boolean };

/**
 * Une session telle que `auth-js` la range. `expired` la date d'une heure
 * en arrière : au lancement, `auth-js` doit la renouveler avant de la rendre,
 * ce qui arrive presque à chaque ouverture de l'app (§4.1).
 */
export function makeSession(user: StubUser, { expired = false } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = expired ? now - HOUR : now + HOUR;
  return {
    access_token: fakeJwt(user.id, expiresAt, user.is_anonymous),
    token_type: 'bearer',
    expires_in: expired ? 0 : HOUR,
    expires_at: expiresAt,
    refresh_token: `rt-${randomUUID()}`,
    user: {
      id: user.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: user.email ?? '',
      is_anonymous: user.is_anonymous,
      app_metadata: {},
      user_metadata: {},
      identities: [],
      created_at: new Date().toISOString(),
    },
  };
}

export async function startGotrueStub(initial: { refreshUser: StubUser }): Promise<GotrueStub> {
  const stub: GotrueStub = {
    url: '',
    requests: [],
    refresh: { kind: 'ok', delayMs: 0 },
    signups: [],
    fail: new Map(),
    close: async () => {},
  };

  const server: Server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const [path = '', query = ''] = (req.url ?? '').split('?');
      stub.requests.push({ method: req.method ?? '', path, query, body });
      const send = (status: number, payload: unknown) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(payload));
      };

      const failure = stub.fail.get(path);
      if (failure) {
        send(failure.status, failure.body);
        return;
      }

      if (path === '/auth/v1/token' && query.includes('grant_type=refresh_token')) {
        const { kind, delayMs } = stub.refresh;
        setTimeout(() => {
          if (kind === 'revoked') {
            send(400, {
              code: 400,
              error_code: 'refresh_token_not_found',
              msg: 'Invalid Refresh Token: Refresh Token Not Found',
            });
          } else {
            send(200, makeSession(initial.refreshUser));
          }
        }, delayMs);
        return;
      }

      if (path === '/auth/v1/signup') {
        const id = randomUUID();
        stub.signups.push(id);
        send(200, makeSession({ id, is_anonymous: true }));
        return;
      }

      if (path === '/auth/v1/user' && req.method === 'PUT') {
        // Une adresse demandée attend son code dans `new_email` : le compte
        // reste anonyme, comme le fait GoTrue (contrôle 2 de check-account).
        const { email } = JSON.parse(body || '{}') as { email?: string };
        send(200, { ...makeSession(initial.refreshUser).user, new_email: email ?? null });
        return;
      }

      if (path === '/auth/v1/user') {
        send(200, makeSession(initial.refreshUser).user);
        return;
      }

      if (path === '/auth/v1/otp') {
        send(200, {});
        return;
      }

      if (path === '/auth/v1/verify') {
        const { email } = JSON.parse(body || '{}') as { email?: string };
        send(200, makeSession({ ...initial.refreshUser, is_anonymous: false, email: email ?? null }));
        return;
      }

      if (path.startsWith('/rest/v1/rpc/')) {
        res.writeHead(204);
        res.end();
        return;
      }

      send(404, { msg: `route absente du bouchon : ${path}` });
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  stub.url = `http://127.0.0.1:${port}`;
  stub.close = () =>
    new Promise<void>((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    });
  return stub;
}

/** Un stockage en mémoire, à la place d'AsyncStorage. */
export function memoryStorage() {
  const items = new Map<string, string>();
  return {
    items,
    getItem: async (key: string) => items.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      items.set(key, value);
    },
    removeItem: async (key: string) => {
      items.delete(key);
    },
  };
}
