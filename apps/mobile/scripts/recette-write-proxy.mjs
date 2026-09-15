/**
 * Proxy de recette **en écriture**, bridé à un seul compte de recette.
 *
 * La règle reste de ne jamais écrire en production : `readonly-proxy.mjs`
 * couvre tout ce qui se lit. Ce script sert l'exception, à arbitrer chaque
 * fois, d'un parcours qui ne se recette qu'en écrivant : publier son bento et
 * arriver sur sa page, sa propre page sans bento. Première utilisation au
 * chantier 7, lot 4, cf. `docs/RECETTE-MOBILE.md` §1.
 *
 * Les apps compilées gardent leur cible `127.0.0.1:8098` : c'est ce proxy qui
 * relaie vers la production, et il ne laisse passer que ceci :
 *
 *   1. **une seule inscription**, `POST /auth/v1/signup`. Le compte ainsi créé
 *      devient le compte de recette. Toute inscription suivante répond 503 :
 *      l'app qui se réinitialise après une suppression de compte ne peut pas
 *      en recréer un, ni un autre appareil branché par erreur ;
 *   2. **les écritures PostgREST du seul compte de recette**, reconnu au `sub`
 *      de son jeton. Les fonctions en lecture de `RPC_READ` passent pour tous ;
 *   3. **quatre routes d'authentification** : inscription, renouvellement,
 *      utilisateur, déconnexion. Toute autre répond 405 ;
 *   4. **un coupe-circuit** : tant que le fichier `READONLY_FLAG` existe, plus
 *      aucune écriture ni inscription ne passe.
 *
 * Chaque échange est journalisé, les écritures marquées ÉCRITURE, sans jamais
 * imprimer un jeton : seulement le `sub` du compte de recette.
 *
 * `DELAY_FILE` contient un nombre de millisecondes dont sont retardées les
 * lectures dont l'URL commence par `DELAY_PATH` : le réseau ralenti de la
 * recette. Réglable à chaud, `echo 1500 > "$DELAY_FILE"`.
 *
 * ─── Usage ────────────────────────────────────────────────────────────
 *
 *   cd apps/mobile && set -a && . ./.env && set +a
 *   TARGET="$EXPO_PUBLIC_SUPABASE_URL" KEY="$EXPO_PUBLIC_SUPABASE_ANON_KEY" \
 *   READONLY_FLAG=/tmp/recette-coupe-circuit DELAY_FILE=/tmp/recette-retard \
 *     node scripts/recette-write-proxy.mjs
 *
 * Avant de le lancer : un seul appareil avec l'app ouverte, sans session
 * `sb-127-auth-token`, tous les autres fermés. Après : supprimer le compte de
 * recette, profil puis compte d'authentification.
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';

const TARGET = process.env.TARGET;
const KEY = process.env.KEY;
const PORT = Number(process.env.PORT ?? 8098);
const READONLY_FLAG = process.env.READONLY_FLAG;
const DELAY_PATH = process.env.DELAY_PATH ?? '/rest/v1/users';
const DELAY_FILE = process.env.DELAY_FILE;

if (!TARGET || !KEY || !READONLY_FLAG || !DELAY_FILE) {
  console.error('TARGET, KEY, READONLY_FLAG et DELAY_FILE sont requis. Voir le docblock.');
  process.exit(1);
}

/** Fonctions SQL `stable` que l'app appelle en POST, relayées pour tous. */
const RPC_READ = new Set([
  'search_items',
  'find_similar_items',
  'popular_items',
  'search_bentos',
  'shared_items',
]);

/** Routes d'authentification relayées ; toute autre répond 405. */
const AUTH_ROUTES = [
  /^POST \/auth\/v1\/signup/,
  /^POST \/auth\/v1\/token\?grant_type=refresh_token/,
  /^GET \/auth\/v1\/user/,
  /^POST \/auth\/v1\/logout/,
];

let recetteUserId = null;
let signups = 0;

const log = console.log;
console.log = (...args) => log(new Date().toISOString().slice(11, 23), ...args);

function delayMs() {
  try {
    return Number(readFileSync(DELAY_FILE, 'utf8').trim()) || 0;
  } catch {
    return 0;
  }
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

/** `sub` d'un JWT, sans vérifier sa signature : Supabase la vérifiera. */
function jwtSub(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')).sub ?? null;
  } catch {
    return null;
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

createServer(async (req, res) => {
  const started = Date.now();
  const url = req.url ?? '/';
  const route = `${req.method} ${url}`;
  const frozen = existsSync(READONLY_FLAG);
  const bearer = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  const sub = jwtSub(bearer);
  const rpc = url.match(/^\/rest\/v1\/rpc\/([^/?]+)/)?.[1] ?? null;
  const isWrite = req.method !== 'GET' && req.method !== 'HEAD' && !(rpc && RPC_READ.has(rpc));

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (url.startsWith('/auth/')) {
    if (!AUTH_ROUTES.some((allowed) => allowed.test(route))) {
      console.log(405, route, 'route d’authentification refusée');
      return json(res, 405, { message: 'route refusée par le proxy de recette', code: '405' });
    }
    if (route.startsWith('POST /auth/v1/signup') && (frozen || signups >= 1)) {
      console.log(503, route, frozen ? 'coupe-circuit' : 'inscription déjà faite, refusée');
      return json(res, 503, {
        message: 'inscription refusée par le proxy de recette',
        code: '503',
      });
    }
  } else if (isWrite) {
    if (frozen) {
      console.log(405, route, 'coupe-circuit');
      return json(res, 405, { message: 'coupe-circuit du proxy de recette', code: '405' });
    }
    if (!recetteUserId || sub !== recetteUserId) {
      console.log(405, route, `jeton étranger au compte de recette (${sub})`);
      return json(res, 405, { message: 'écriture hors du compte de recette', code: '405' });
    }
  }

  const delay = req.method === 'GET' && url.startsWith(DELAY_PATH) ? delayMs() : 0;
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay));

  try {
    const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req);
    const headers = {};
    for (const [name, value] of Object.entries(req.headers)) {
      if (['host', 'connection', 'content-length', 'accept-encoding'].includes(name)) continue;
      headers[name] = value;
    }
    headers.apikey = KEY;
    // Sans session, le client envoie sa clé compilée comme jeton : la vraie clé la remplace.
    if (!sub) headers.authorization = `Bearer ${KEY}`;
    const upstream = await fetch(TARGET + url, { method: req.method, headers, body });
    const out = Buffer.from(await upstream.arrayBuffer());

    if (route.startsWith('POST /auth/v1/signup') && upstream.ok) {
      signups += 1;
      try {
        const parsed = JSON.parse(out.toString('utf8'));
        recetteUserId = parsed.user?.id ?? parsed.id ?? null;
      } catch {
        recetteUserId = null;
      }
      console.log('COMPTE DE RECETTE CRÉÉ', recetteUserId);
    }

    console.log(
      upstream.status,
      isWrite || url.startsWith('/auth/') ? 'ÉCRITURE' : 'lecture',
      route.slice(0, 170),
      `${out.length}o`,
      `${Date.now() - started}ms`,
      delay ? `(retard ${delay}ms)` : '',
      sub ? `jeton ${sub === recetteUserId ? 'recette' : sub}` : 'anonyme',
    );
    const outHeaders = {};
    upstream.headers.forEach((value, name) => {
      if (
        ['content-encoding', 'transfer-encoding', 'content-length', 'connection'].includes(name)
      ) {
        return;
      }
      outHeaders[name] = value;
    });
    outHeaders['content-length'] = out.length;
    res.writeHead(upstream.status, outHeaders);
    res.end(out);
  } catch (err) {
    console.log(502, route, String(err));
    json(res, 502, { error: String(err) });
  }
}).listen(PORT, () => {
  console.log(
    `proxy de recette EN ÉCRITURE sur ${PORT} → ${TARGET}\n` +
      '  une inscription au plus, écritures du seul compte de recette\n' +
      `  coupe-circuit : ${READONLY_FLAG}\n  retard : ${DELAY_FILE} sur ${DELAY_PATH}`,
  );
});
