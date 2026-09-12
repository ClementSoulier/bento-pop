import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { SupabaseClientOptions } from '@supabase/supabase-js';

/**
 * Bouchon PostgREST pour les tests d'intégration de la couche de données.
 *
 * On bouchonne au niveau du **protocole**, pas du client : le vrai
 * `@supabase/supabase-js` construit ses requêtes et les envoie sur le réseau
 * local. Un mock du client aurait laissé hors couverture tout ce qui casse en
 * pratique, à commencer par l'encodage d'URL, qui est exactement le sujet
 * (cf. le `+` du décalage horaire dans `feed.ts`).
 *
 * Aucun branchement de test dans le code de production, et aucun identifiant
 * Supabase requis en CI.
 *
 * Ce fichier ne se termine pas par `.test.ts`, il n'est donc pas ramassé par
 * le glob de `pnpm test`.
 */

export type StubRequest = {
  method: string;
  /** Chemin brut, ex. `/rest/v1/bentos`. */
  path: string;
  /**
   * Chaîne de requête **brute**, telle qu'envoyée sur le fil, sans décodage.
   * C'est la seule forme qui permet d'assurer qu'un `+` est bien parti en
   * `%2B` : la version décodée les rendrait indiscernables.
   */
  rawQuery: string;
  /** Chaîne de requête décodée, plus lisible pour les assertions de forme. */
  query: string;
  /**
   * Corps brut de la requête, vide pour un `GET`.
   *
   * PostgREST expose les fonctions SQL en `POST` avec les arguments dans le
   * corps : sans ça, un test de RPC ne pourrait rien assurer d'autre que le
   * nom de la fonction dans l'URL.
   */
  body: string;
};

type Reply = { status: number; body: unknown };

export type PostgrestStub = {
  /** À passer tel quel à `createClient`. */
  url: string;
  /** Requêtes reçues, dans l'ordre. */
  requests: StubRequest[];
  /** Empile une réponse. Les réponses sont consommées dans l'ordre d'ajout. */
  enqueue: (body: unknown, status?: number) => void;
  close: () => Promise<void>;
};

/**
 * Options à passer à `createClient` dans un test.
 *
 * `supabase-js` instancie un `RealtimeClient` dès `createClient`, et
 * `realtime-js` réclame un WebSocket natif. Node ne l'expose qu'à partir de
 * la 22, or le dépôt est en 20 (`.nvmrc`), donc la construction du client
 * jette avant même la première requête.
 *
 * Le `transport` court-circuite la détection (`options?.transport ??
 * getWebSocketConstructor()`). La classe n'est jamais instanciée : aucun test
 * n'ouvre de canal temps réel, et la couche de données n'en utilise pas.
 * Plus léger que d'ajouter `ws` en dépendance pour une fonctionnalité que
 * l'app n'emploie nulle part.
 *
 * `persistSession` désactivé : sans stockage, `supabase-js` chercherait
 * `localStorage`.
 */
export const STUB_CLIENT_OPTIONS: SupabaseClientOptions<'public'> = {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: class {} as never },
};

export async function startPostgrestStub(): Promise<PostgrestStub> {
  const requests: StubRequest[] = [];
  const replies: Reply[] = [];

  const server: Server = createServer((req, res) => {
    const raw = req.url ?? '';
    const cut = raw.indexOf('?');
    const rawQuery = cut === -1 ? '' : raw.slice(cut + 1);

    // La réponse n'est envoyée qu'une fois le corps entièrement lu : y
    // répondre plus tôt marcherait pour un `GET` mais laisserait le corps
    // d'un `POST` de RPC hors de portée des assertions.
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      requests.push({
        method: req.method ?? 'GET',
        path: cut === -1 ? raw : raw.slice(0, cut),
        rawQuery,
        query: decodeURIComponent(rawQuery),
        body: Buffer.concat(chunks).toString('utf8'),
      });

      // Défaut : liste vide. Un test qui oublie d'empiler une réponse obtient
      // un résultat vide plutôt qu'une attente infinie.
      const reply = replies.shift() ?? { status: 200, body: [] };
      const payload = JSON.stringify(reply.body);
      res.writeHead(reply.status, {
        'content-type': 'application/json; charset=utf-8',
        'content-length': Buffer.byteLength(payload),
      });
      res.end(payload);
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    enqueue: (body, status = 200) => replies.push({ status, body }),
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}
