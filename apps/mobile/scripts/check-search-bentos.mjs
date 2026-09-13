/**
 * Vérifie `search_bentos` et `shared_items` contre la vraie base, en lecture
 * seule.
 *
 * Ce que ce script couvre et que les tests automatiques ne peuvent pas :
 * l'**absence de cul-de-sac**, qui est tout le sujet du chantier 6 et qui ne
 * se prouve que contre les vraies données ; l'échappement effectif des jokers
 * `ilike` ; le rattrapage des fautes de frappe par la similarité ; et la
 * latence réelle.
 *
 * La CI n'a pas d'identifiants Supabase, donc ce script se lance à la main,
 * après application de la migration `search_bentos` dans le SQL editor.
 *
 *   set -a && . apps/mobile/.env && set +a
 *   TARGET="$EXPO_PUBLIC_SUPABASE_URL" KEY="$EXPO_PUBLIC_SUPABASE_ANON_KEY" \
 *     node apps/mobile/scripts/check-search-bentos.mjs
 *
 * Une clé anon suffit, et c'est voulu : les fonctions sont en
 * `security invoker`, donc les exercer sous la clé de service testerait un
 * chemin que l'app ne prend jamais.
 *
 * Cf. `docs/UX-06-TROUVER.md` §6.1 et §8.3.
 */
const TARGET = process.env.TARGET;
const KEY = process.env.KEY;

if (!TARGET || !KEY) {
  console.error('TARGET et KEY sont requis. Voir le docblock de ce fichier.');
  process.exit(1);
}

/** Budget de latence à chaud, cf. spec §2. Mesuré à ~52 ms le 13/09/2026. */
const LATENCY_BUDGET_MS = 200;

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

const search = (q, lim = 20) => rpc('search_bentos', { q, lim });

async function main() {
  console.log(`search_bentos sur ${TARGET}\n`);

  // Premier appel non mesuré : il porte l'établissement TLS et le démarrage
  // du pooler, et tourne à ~400 ms contre ~52 ms ensuite.
  const probe = await search('inception');
  if (!probe.ok) {
    console.error(
      `\nLa fonction ne répond pas (${probe.status}) : ${JSON.stringify(probe.json)}\n` +
        `Migration search_bentos appliquée dans le SQL editor ?`,
    );
    process.exit(1);
  }

  // ─── Vérité de terrain ──────────────────────────────────────────────
  // Sous clé anon, la RLS de `bentos` laisse déjà passer les seuls bentos
  // publiés. On la relit malgré tout, et c'est justement l'intérêt : si la
  // policy changeait, la liste des pseudos joignables changerait avec elle
  // et le contrôle ci-dessous s'en apercevrait.
  const published = await get('bentos?select=id,users(pseudo)&published_at=not.is.null&limit=1000');
  const liveBentoIds = new Set(published.map((b) => b.id));
  const livePseudos = new Set(published.map((b) => b.users?.pseudo?.toLowerCase()).filter(Boolean));
  console.log(`Vérité de terrain : ${liveBentoIds.size} bentos publiés, ${livePseudos.size} pseudos joignables\n`);

  // ─── L'invariant du chantier ────────────────────────────────────────
  console.log('[aucun cul-de-sac]');
  const shared = await rpc('shared_items', { lim: 12 });
  const probes = [
    ...[...livePseudos],
    ...shared.json.map((i) => i.title.slice(0, 8)),
  ];
  let rowsSeen = 0;
  let dead = 0;
  let duplicated = 0;
  const latencies = [];
  for (const q of probes) {
    const res = await search(q);
    latencies.push(res.ms);
    if (!res.ok) {
      failures += 1;
      console.log(`  ECHEC « ${q} » → ${res.status}`);
      continue;
    }
    rowsSeen += res.json.length;
    const ids = res.json.map((r) => r.bento_id);
    if (new Set(ids).size !== ids.length) {
      duplicated += 1;
      console.log(`        doublon de bento sur « ${q} »`);
    }
    for (const r of res.json) {
      if (!liveBentoIds.has(r.bento_id) || !livePseudos.has(r.pseudo.toLowerCase())) {
        dead += 1;
        console.log(`        cul-de-sac sur « ${q} » → @${r.pseudo}`);
      }
    }
  }
  check(
    'tout résultat mène à un bento publié',
    dead === 0,
    `${rowsSeen} lignes sur ${probes.length} requêtes`,
  );
  check('un bento apparaît au plus une fois par recherche', duplicated === 0);

  // ─── Correspondances ────────────────────────────────────────────────
  console.log('\n[correspondances]');

  // Le préfixe ratait `dark_hifus` : 19 % des pseudos portent un `_` et leur
  // partie signifiante est après.
  const hifus = await search('hifus');
  check(
    'la sous-chaîne trouve un pseudo composé',
    hifus.json.some((r) => r.pseudo.toLowerCase().includes('hifus')),
    `« hifus » → ${hifus.json.length}`,
  );

  const inception = await search('inception');
  check(
    'une correspondance par item est étiquetée comme telle',
    inception.json.length > 0 && inception.json.every((r) => r.match_kind === 'item'),
    `« inception » → ${inception.json.length}`,
  );
  check(
    'une correspondance par item porte sa raison',
    inception.json.every((r) => r.item_id && r.item_title && r.category_id !== null),
  );

  // La similarité existe pour ça, et elle seule : `ilike` ne rattrape rien.
  const typo = await search('incepton');
  check(
    'la similarité rattrape une faute de frappe',
    typo.json.length === inception.json.length && typo.json.length > 0,
    `« incepton » → ${typo.json.length}`,
  );

  // Le titre le plus long de la production fait 51 caractères, et la
  // similarité s'y dilue à 0,23. C'est la sous-chaîne qui le sauve.
  const long = await search('seigneur');
  check(
    'la sous-chaîne trouve un titre long',
    long.json.length > 0,
    `« seigneur » → ${long.json.length}`,
  );

  // Le seuil relevé de 0,15 à 0,3 sert exactement à ça.
  const angers = await search('angers');
  check(
    'le seuil de similarité écarte le bruit',
    angers.json.length > 0 &&
      !angers.json.some((r) => /Los Angeles|Angoulême/.test(r.item_title ?? '')),
    `« angers » → ${angers.json.map((r) => r.item_title).join(', ')}`,
  );

  // ─── Jokers ilike ───────────────────────────────────────────────────
  console.log('\n[jokers ilike]');

  // Sans échappement, `%` renverrait la totalité du corpus.
  const pct = await search('%');
  check('« % » est échappé', pct.json.length === 0, `${pct.json.length} ligne(s)`);

  // Sans échappement, `_` renverrait tout aussi. Avec, il ne trouve que les
  // vrais underscores : 14 pseudos et 2 titres en portent un.
  const underscore = await search('_');
  check(
    '« _ » est échappé, et trouve les vrais underscores',
    underscore.json.length > 0 &&
      underscore.json.length < liveBentoIds.size &&
      underscore.json.every((r) => `${r.pseudo}${r.item_title ?? ''}`.includes('_')),
    `${underscore.json.length} ligne(s) : ${underscore.json.map((r) => r.pseudo).join(', ')}`,
  );

  const nothing = await search('zzzzqx');
  check('une requête sans correspondance rend zéro ligne', nothing.json.length === 0);

  // ─── Limite ─────────────────────────────────────────────────────────
  console.log('\n[limite]');
  const capped = await search('a', 3);
  check('lim est respecté', capped.json.length <= 3, `${capped.json.length}/3`);

  // ─── shared_items ───────────────────────────────────────────────────
  console.log('\n[shared_items]');
  check('répond 200', shared.ok, `en ${Math.round(shared.ms)} ms`);
  check('au plus 12 lignes', shared.json.length <= 12, `${shared.json.length}/12`);
  check(
    'toutes les lignes sont dans au moins deux bentos',
    shared.json.every((i) => Number.isInteger(i.picks) && i.picks >= 2),
    JSON.stringify(shared.json.map((i) => i.picks)),
  );
  check(
    'picks décroissant',
    shared.json.every((i, n) => n === 0 || shared.json[n - 1].picks >= i.picks),
  );
  check('pas de doublon', new Set(shared.json.map((i) => i.id)).size === shared.json.length);
  // Le bloc n'affiche pas d'images : les exposer inviterait à en afficher.
  check("n'expose pas image_url", shared.json.every((i) => !('image_url' in i)));

  // Chaque suggestion doit ramener au moins deux personnes, sans quoi elle
  // promet une découverte qu'elle ne tient pas.
  let thin = 0;
  for (const item of shared.json) {
    const res = await search(item.title);
    if (res.json.length < 2) {
      thin += 1;
      console.log(`        « ${item.title} » annonce ${item.picks} et ramène ${res.json.length}`);
    }
  }
  check('chaque suggestion ramène au moins deux résultats', thin === 0);

  const second = await rpc('shared_items', { lim: 12 });
  check(
    'ordre identique entre deux appels',
    JSON.stringify(shared.json.map((i) => i.id)) === JSON.stringify(second.json.map((i) => i.id)),
  );

  // ─── Latence ────────────────────────────────────────────────────────
  console.log('\n[latence]');
  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length / 2)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  check(
    `p50 sous ${LATENCY_BUDGET_MS} ms`,
    p50 < LATENCY_BUDGET_MS,
    `p50 ${Math.round(p50)} ms · p95 ${Math.round(p95)} ms · ${latencies.length} appels`,
  );

  console.log(
    failures === 0
      ? '\nTout est vert.'
      : `\n${failures} contrôle(s) en échec.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
