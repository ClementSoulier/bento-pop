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
 *   2. Seuls les `GET` sont relayés. Tout le reste répond 405, donc une
 *      erreur de manipulation ne peut pas modifier la base.
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
 * `FAIL=/rest/v1/bentos` fait répondre 500 à tout chemin commençant par
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

if (!TARGET || !KEY) {
  console.error('TARGET et KEY sont requis. Voir le docblock de ce fichier.');
  process.exit(1);
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,OPTIONS',
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
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'lecture seule' });
  }

  try {
    const upstream = await fetch(TARGET + url, {
      headers: { apikey: KEY, authorization: `Bearer ${KEY}`, accept: 'application/json' },
    });
    const body = Buffer.from(await upstream.arrayBuffer());
    console.log(upstream.status, url.slice(0, 120));
    res.writeHead(upstream.status, {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
      'content-length': body.length,
      ...CORS,
    });
    res.end(body);
  } catch (err) {
    json(res, 502, { error: String(err) });
  }
}).listen(PORT, () => {
  console.log(`proxy lecture seule sur ${PORT} → ${TARGET}${FAIL ? ` (panne simulée sur ${FAIL})` : ''}`);
});
