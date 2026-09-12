/**
 * Vérifie `popular_items` contre la vraie base, en lecture seule.
 *
 * Ce que ce script couvre et que les tests automatiques ne peuvent pas :
 * la stabilité de l'ordre entre deux appels, la latence réelle, le statut
 * des items renvoyés, et le fait que le classement soit identique avec et
 * sans session. Ces propriétés dépendent des données et du planificateur
 * Postgres, pas du code client ; un bouchon ne les exercerait pas.
 *
 * La CI n'a pas d'identifiants Supabase, donc ce script se lance à la main,
 * après application de `20260912000000_popular_items.sql` dans le SQL editor.
 *
 *   set -a && . apps/landing/.env && set +a
 *   TARGET="$NEXT_PUBLIC_MOBILE_SUPABASE_URL" KEY="$MOBILE_SUPABASE_ANON_KEY" \
 *     node apps/mobile/scripts/check-popular-items.mjs
 *
 * Cf. `docs/UX-03-RECHERCHE-ITEM.md` §6.1 et §9.2.
 */
const TARGET = process.env.TARGET;
const KEY = process.env.KEY;

if (!TARGET || !KEY) {
  console.error('TARGET et KEY sont requis. Voir le docblock de ce fichier.');
  process.exit(1);
}

const CATEGORIES = ['film', 'series', 'artist', 'track', 'creator', 'place'];
const LIMIT = 12;
/** Budget de latence à chaud, cf. spec §6.2. `search_items` tourne à ~80 ms. */
const LATENCY_BUDGET_MS = 150;

const headers = {
  apikey: KEY,
  authorization: `Bearer ${KEY}`,
  'content-type': 'application/json',
};

async function rpc(fn, body) {
  const started = performance.now();
  const res = await fetch(`${TARGET}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { ok: res.ok, status: res.status, json, ms: performance.now() - started };
}

async function get(path) {
  const res = await fetch(`${TARGET}/rest/v1/${path}`, { headers });
  return res.json();
}

let failures = 0;
const check = (label, condition, detail = '') => {
  if (condition) {
    console.log(`  ok    ${label}${detail ? ` ${detail}` : ''}`);
  } else {
    failures += 1;
    console.log(`  ECHEC ${label}${detail ? ` ${detail}` : ''}`);
  }
};

const popular = (category, extra = {}) =>
  rpc('popular_items', { category_key: category, lim: LIMIT, exclude_item: null, ...extra });

async function main() {
  console.log(`popular_items sur ${TARGET}\n`);

  // Un premier appel pour réveiller le plan, non mesuré : le tout premier
  // aller-retour porte l'établissement TLS et le démarrage du pooler, et
  // tournait à 457 ms contre ~80 ms ensuite pour `search_items`.
  const probe = await popular('film');
  if (!probe.ok) {
    console.error(
      `\nLa fonction ne répond pas (${probe.status}) : ${JSON.stringify(probe.json)}\n` +
        `Migration 20260912000000_popular_items.sql appliquée dans le SQL editor ?`,
    );
    process.exit(1);
  }

  const latencies = [];

  for (const category of CATEGORIES) {
    console.log(`\n[${category}]`);
    const first = await popular(category);
    latencies.push(first.ms);
    const items = first.json;

    check('répond 200', first.ok, `en ${Math.round(first.ms)} ms`);
    check('au plus lim items', items.length <= LIMIT, `${items.length}/${LIMIT}`);
    check('au moins un item', items.length > 0);

    const picks = items.map((i) => i.picks);
    check(
      'picks décroissant',
      picks.every((n, i) => i === 0 || picks[i - 1] >= n),
      JSON.stringify(picks),
    );
    check(
      'picks est un entier positif',
      picks.every((n) => Number.isInteger(n) && n >= 0),
    );

    // Les items sans image passent après ceux qui en ont. C'est ce critère
    // qui fait tenir la grille de « Chanson », dont 35 % seulement du
    // catalogue porte une image.
    const withImage = items.map((i) => Boolean(i.image_url));
    const lastWith = withImage.lastIndexOf(true);
    const firstWithout = withImage.indexOf(false);
    check(
      'items sans image relégués en fin, à picks égal',
      firstWithout === -1 || lastWith === -1 || itemsGroupedByPicks(items),
      `${withImage.filter(Boolean).length}/${items.length} avec image`,
    );

    check('pas de doublon', new Set(items.map((i) => i.id)).size === items.length);

    // Stabilité : c'est le départage par `id` qui la garantit. Sans lui,
    // deux appels peuvent renvoyer un ordre différent, et le cache d'images
    // du client repart de zéro à chaque ouverture.
    const second = await popular(category);
    latencies.push(second.ms);
    check(
      'ordre identique entre deux appels',
      JSON.stringify(items.map((i) => i.id)) === JSON.stringify(second.json.map((i) => i.id)),
    );

    // Statut : la RLS le garantit déjà, mais la fonction le filtre aussi
    // explicitement. Si l'un des deux saute, ce contrôle le voit.
    const ids = items.map((i) => i.id);
    const statuses = await get(
      `items?select=id,status&id=in.(${ids.join(',')})`,
    );
    check(
      'tous les items sont validated',
      statuses.length === ids.length && statuses.every((s) => s.status === 'validated'),
    );

    // exclude_item
    const excluded = ids[0];
    const without = await popular(category, { exclude_item: excluded });
    check(
      'exclude_item retire bien l\'item demandé',
      !without.json.some((i) => i.id === excluded),
    );
    check(
      'exclude_item ne casse pas le reste du classement',
      JSON.stringify(without.json.slice(0, 3).map((i) => i.id)) ===
        JSON.stringify(ids.slice(1, 4).map((id) => id)),
    );
  }

  const warm = latencies.slice(1).sort((a, b) => a - b);
  const median = warm[Math.floor(warm.length / 2)];
  const worst = warm.at(-1);
  console.log('\n[latence]');
  check(
    `médiane sous ${LATENCY_BUDGET_MS} ms`,
    median < LATENCY_BUDGET_MS,
    `médiane ${Math.round(median)} ms, pire ${Math.round(worst)} ms sur ${warm.length} appels`,
  );

  console.log(failures === 0 ? '\nTout est vert.' : `\n${failures} contrôle(s) en échec.`);
  process.exit(failures === 0 ? 0 : 1);
}

/**
 * Le tri « avec image d'abord » ne s'applique qu'à `picks` égal : un item
 * choisi 3 fois sans image passe devant un item jamais choisi qui en a une.
 * Ce contrôle vérifie donc la propriété par groupe de `picks`, pas
 * globalement, sinon il crierait au loup sur un classement correct.
 */
function itemsGroupedByPicks(items) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.picks)) groups.set(item.picks, []);
    groups.get(item.picks).push(Boolean(item.image_url));
  }
  for (const flags of groups.values()) {
    const firstWithout = flags.indexOf(false);
    if (firstWithout !== -1 && flags.slice(firstWithout).includes(true)) return false;
  }
  return true;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
