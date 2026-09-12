/**
 * Proxy Supabase en lecture seule, pour les recettes sur simulateur.
 *
 * Permet de faire tourner l'app sur de vraies données de production sans rien
 * y écrire. Deux garanties, et c'est tout l'intérêt du script :
 *
 *   1. `/auth/*` est court-circuité, donc le `signInAnonymously` du boot ne
 *      crée pas de compte anonyme dans le projet. Sans ça, chaque lancement
 *      de recette ajoute une ligne dans `auth.users` et fait monter le
 *      compteur d'utilisateurs actifs du tableau de bord.
 *   2. Seuls les `GET` sont relayés, plus les `POST` vers une liste
 *      blanche de fonctions RPC connues pour être en lecture (`stable`
 *      côté SQL). Tout le reste répond 405, donc une erreur de
 *      manipulation ne peut pas modifier la base.
 *
 *      La liste blanche est nécessaire parce que PostgREST expose les
 *      fonctions SQL en POST : sans elle, `search_items` et consorts
 *      répondent 405 et tout l'écran de recherche est intestable en
 *      recette. Une liste plutôt qu'une autorisation générale de
 *      `/rest/v1/rpc/` : rien ne garantit qu'une future fonction ne
 *      fera pas d'écriture, et la garantie de ce script est justement
 *      qu'aucune recette ne peut toucher la production.
 *
 * La clé anonyme est réinjectée à chaque requête relayée : ce que le client
 * envoie comme jeton n'a aucune importance, et l'app peut être lancée avec
 * une clé bidon.
 *
 * L'app démarre malgré l'échec de `/auth/*` : `session.init()` avale son
 * erreur et pose `initialized` dans son `finally`. Le fil est lisible sans
 * session, la RLS `bentos_read_published` autorisant le rôle anonyme.
 *
 * ─── Usage ────────────────────────────────────────────────────────────
 *
 *   TARGET=https://<projet>.supabase.co KEY=<clé anonyme> \
 *     node apps/mobile/scripts/readonly-proxy.mjs
 *
 * puis lancer l'app en pointant dessus :
 *
 *   EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:8098 \
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY=recette \
 *     npx expo run:ios
 *
 * Sur émulateur Android, ajouter `adb reverse tcp:8098 tcp:8098` pour que
 * `127.0.0.1` du device pointe sur l'hôte.
 *
 * ─── Simuler une panne ────────────────────────────────────────────────
 *
 * `FAIL=/rest/v1/rpc/popular_items` fait répondre 500 à tout chemin commençant par
 * cette valeur, ce qui permet d'atteindre les états d'erreur d'un écran
 * sans couper le réseau entier (couper tout bloque l'app sur le splash,
 * cf. `docs/RECETTE-MOBILE.md`).
 *
 * Cf. `docs/RECETTE-MOBILE.md` pour le mode d'emploi complet et les pièges.
 */
import { createServer } from 'node:http';

const TARGET = process.env.TARGET;
const KEY = process.env.KEY;
const PORT = Number(process.env.PORT ?? 8098);
const FAIL = process.env.FAIL ?? '';

/**
 * Fonctions RPC relayables en POST. Toutes sont `language sql stable`
 * dans `apps/mobile/supabase/migrations/`, donc incapables d'écrire.
 * Surchargeable par `RPC_ALLOW=a,b,c` pour une recette ponctuelle.
 */
const RPC_ALLOW = new Set(
  (process.env.RPC_ALLOW ?? 'search_items,find_similar_items,popular_items')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);

/** `/rest/v1/rpc/search_items?x=1` → `search_items`. */
const rpcName = (url) => url.match(/^\/rest\/v1\/rpc\/([^/?]+)/)?.[1] ?? null;

if (!TARGET || !KEY) {
  console.error('TARGET et KEY sont requis. Voir le docblock de ce fichier.');
  process.exit(1);
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
};

const json = (res, status, body) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    ...CORS,
  });
  res.end(payload);
};

createServer(async (req, res) => {
  const url = req.url ?? '/';

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    return res.end();
  }
  if (url.startsWith('/auth/')) {
    return json(res, 503, { error: 'auth desactivee en recette' });
  }
  if (FAIL && url.startsWith(FAIL)) {
    return json(res, 500, { message: 'panne simulee', code: '500' });
  }
  // PostgREST expose les fonctions SQL en POST. On les relaie si et
  // seulement si elles sont dans la liste blanche.
  const rpc = req.method === 'POST' ? rpcName(url) : null;
  if (req.method !== 'GET' && !(rpc && RPC_ALLOW.has(rpc))) {
    // `message` et non `error` : c'est le champ que lit supabase-js pour
    // construire son `error.message`. Avec `error`, l'app affichait
    // « Search failed: undefined » au lieu de la raison du refus.
    return json(res, 405, {
      message: rpc
        ? `rpc ${rpc} hors liste blanche (RPC_ALLOW)`
        : 'lecture seule',
      code: '405',
    });
  }

  try {
    const body = rpc ? await readBody(req) : undefined;
    const upstream = await fetch(TARGET + url, {
      method: req.method,
      headers: {
        apikey: KEY,
        authorization: `Bearer ${KEY}`,
        accept: 'application/json',
        ...(rpc ? { 'content-type': 'application/json' } : {}),
      },
      body,
    });
    const out = Buffer.from(await upstream.arrayBuffer());
    console.log(upstream.status, req.method, url.slice(0, 120), `${out.length}o`);
    res.writeHead(upstream.status, {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
      'content-length': out.length,
      ...CORS,
    });
    res.end(out);
  } catch (err) {
    json(res, 502, { error: String(err) });
  }
}).listen(PORT, () => {
  console.log(
    `proxy lecture seule sur ${PORT} → ${TARGET}` +
      `\n  rpc autorisées : ${[...RPC_ALLOW].join(', ')}` +
      (FAIL ? `\n  panne simulée sur ${FAIL}` : ''),
  );
});

/** Lit le corps d'une requête entrante, pour le retransmettre tel quel. */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
