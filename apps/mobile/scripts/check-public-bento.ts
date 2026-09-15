/**
 * Vérifie `loadPublicBento` contre la vraie base, en lecture seule.
 *
 * C'est la fonction de l'app qui part, pas une requête recopiée : le module
 * est à client injecté, donc chargeable ici avec un vrai `supabase-js` pointé
 * sur la production. Un script qui réécrirait l'URL vérifierait les données,
 * pas ce que l'app envoie.
 *
 * Ce que le bouchon des tests ne peut pas couvrir : que PostgREST accepte le
 * filtre imbriqué et l'échappement, que la RLS laisse voir à un anonyme ce
 * qu'il faut, et le poids et la latence réels.
 *
 * La CI n'a pas d'identifiants Supabase, donc il se lance à la main :
 *
 *   cd apps/mobile && set -a && . ./.env && set +a
 *   TARGET="$EXPO_PUBLIC_SUPABASE_URL" KEY="$EXPO_PUBLIC_SUPABASE_ANON_KEY" \
 *     npx tsx scripts/check-public-bento.ts
 *
 * Une clé anonyme, et c'est voulu : la clé de service contournerait la RLS,
 * donc exercerait un chemin que l'app ne prend jamais.
 *
 * Cf. `docs/UX-07-PAGE-BENTO-PUBLIQUE-MOBILE.md` §8.3.
 */
import { createClient } from '@supabase/supabase-js';
import { loadPublicBento, type PublicBentoClient } from '../src/lib/public-bento';
// Mêmes options que les tests : Node 20 n'a pas de WebSocket natif, et
// `supabase-js` en réclame un dès `createClient`. Cf. `postgrest-stub.ts`.
import { STUB_CLIENT_OPTIONS } from '../src/test/postgrest-stub';
import type { Database } from '../src/supabase/types';

const TARGET = process.env.TARGET;
const KEY = process.env.KEY;

if (!TARGET || !KEY) {
  console.error('TARGET et KEY sont requis. Voir le docblock de ce fichier.');
  process.exit(1);
}

/** Budgets de la spéc, §8.3 et DoD 6 et 7. Mesurés à 46 ms et 1 991 octets le 14/09/2026. */
const LATENCY_P50_BUDGET_MS = 100;
const PAYLOAD_MEDIAN_BUDGET_BYTES = 2100;

/** Chaque échange HTTP que le client de l'app a réellement fait. */
type Exchange = { url: string; bytes: number; rows: number };
const exchanges: Exchange[] = [];

const recordingFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  const body = await response.clone().text();
  let rows = -1;
  try {
    const json: unknown = JSON.parse(body);
    if (Array.isArray(json)) rows = json.length;
  } catch {
    // Corps non JSON : on garde le poids, sans compte de lignes.
  }
  const url = input instanceof Request ? input.url : String(input);
  exchanges.push({ url, bytes: Buffer.byteLength(body), rows });
  return response;
};

const client: PublicBentoClient = createClient<Database>(TARGET, KEY, {
  ...STUB_CLIENT_OPTIONS,
  global: { fetch: recordingFetch },
});

/** Lecture brute, hors du module : la vérité de terrain ne doit pas passer par ce qu'on vérifie. */
async function groundTruth<T>(path: string): Promise<T> {
  const res = await fetch(`${TARGET}/rest/v1/${path}`, {
    headers: { apikey: KEY!, authorization: `Bearer ${KEY}` },
  });
  if (!res.ok) throw new Error(`${path} → ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

let failures = 0;
function check(label: string, condition: boolean, detail = ''): void {
  if (!condition) failures += 1;
  console.log(`  ${condition ? 'ok   ' : 'ECHEC'} ${label}${detail ? ` ${detail}` : ''}`);
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? Number.NaN;
}

/** Charge un pseudo et rend le résultat avec les échanges qu'il a coûtés. */
async function load(pseudo: string) {
  const before = exchanges.length;
  const started = performance.now();
  const result = await loadPublicBento(client, pseudo);
  const ms = performance.now() - started;
  return { result, ms, calls: exchanges.slice(before) };
}

async function main(): Promise<void> {
  console.log(`loadPublicBento sur ${TARGET}\n`);

  // ─── Vérité de terrain ──────────────────────────────────────────────
  const published = await groundTruth<{ users: { pseudo: string } | null }[]>(
    'bentos?select=users(pseudo)&published_at=not.is.null&limit=1000',
  );
  const livePseudos = published.flatMap((b) => (b.users?.pseudo ? [b.users.pseudo] : []));
  const liveSet = new Set(livePseudos.map((p) => p.toLowerCase()));
  const users = await groundTruth<{ pseudo: string | null }[]>('users?select=pseudo&limit=1000');
  const allPseudos = users.flatMap((u) => (u.pseudo ? [u.pseudo] : []));
  const allSet = new Set(allPseudos.map((p) => p.toLowerCase()));
  console.log(
    `Vérité de terrain : ${livePseudos.length} bentos en ligne, ${allPseudos.length} pseudos lisibles en anonyme\n`,
  );

  const first = livePseudos[0];
  if (!first) {
    console.error('Aucun bento en ligne : rien à vérifier.');
    process.exit(1);
  }

  // Premier appel non mesuré : il porte l'établissement TLS.
  await loadPublicBento(client, first);

  // ─── Bentos en ligne ────────────────────────────────────────────────
  console.log('[bentos en ligne]');
  const latencies: number[] = [];
  const sizes: number[] = [];
  const wrong: string[] = [];
  const partial: string[] = [];
  let notSingleRoundTrip = 0;
  for (const pseudo of livePseudos) {
    const { result, ms, calls } = await load(pseudo);
    latencies.push(ms);
    sizes.push(calls.reduce((sum, c) => sum + c.bytes, 0));
    if (calls.length !== 1) notSingleRoundTrip += 1;
    if (!result?.bento || result.pseudo.toLowerCase() !== pseudo.toLowerCase()) {
      wrong.push(pseudo);
    } else if (Object.keys(result.bento.slots).length !== 6) {
      partial.push(`@${pseudo} (${Object.keys(result.bento.slots).length})`);
    }
  }
  check('chaque bento en ligne se charge, sous son pseudo', wrong.length === 0, wrong.join(', '));
  check('six cases sur chacun', partial.length === 0, partial.join(', '));
  check(
    'un seul aller-retour par ouverture',
    notSingleRoundTrip === 0,
    `${livePseudos.length} ouvertures`,
  );

  const shouted = await load(first.toUpperCase());
  check(
    'la casse du lien ne compte pas',
    shouted.result?.pseudo === first,
    `@${first.toUpperCase()}`,
  );

  // ─── Rien en ligne, introuvable ─────────────────────────────────────
  console.log('\n[rien en ligne et introuvable]');
  const withoutBento = allPseudos.filter((p) => !liveSet.has(p.toLowerCase())).slice(0, 8);
  const misread: string[] = [];
  for (const pseudo of withoutBento) {
    const { result } = await load(pseudo);
    if (!result || result.bento !== null || result.pseudo.toLowerCase() !== pseudo.toLowerCase()) {
      misread.push(pseudo);
    }
  }
  check(
    'un compte sans bento en ligne rend son pseudo, sans bento',
    withoutBento.length > 0 && misread.length === 0,
    `${withoutBento.length} comptes${misread.length ? ` ; faux : ${misread.join(', ')}` : ''}`,
  );

  let ghost = 'zz_personne_42';
  while (allSet.has(ghost)) ghost = `${ghost}x`;
  check('un pseudo inconnu rend null', (await load(ghost)).result === null, `@${ghost}`);

  const offFormat = await load('dark hifus');
  check(
    'un pseudo hors format ne part pas',
    offFormat.calls.length === 0 && offFormat.result === null,
  );

  // ─── Jokers ─────────────────────────────────────────────────────────
  console.log('\n[jokers]');
  const underscored = allPseudos.filter((p) => p.includes('_'));
  const confusions: string[] = [];
  const leakingRows: string[] = [];
  for (const pseudo of underscored) {
    // `_` et `.` : deux pseudos distincts, que le joker confondait.
    const dotted = pseudo.replace(/_/g, '.');
    const expected = allSet.has(dotted.toLowerCase()) ? dotted.toLowerCase() : null;
    const twin = await load(dotted);
    if ((twin.result?.pseudo.toLowerCase() ?? null) !== expected)
      confusions.push(`${dotted} → ${twin.result?.pseudo}`);

    // Le joker à la place de la dernière lettre. `pickExactPseudo` écarterait
    // la ligne côté client et masquerait un échappement perdu : c'est donc la
    // base elle-même qui doit rendre zéro ligne.
    const wildcard = `${pseudo.slice(0, -1)}_`;
    if (!allSet.has(wildcard.toLowerCase())) {
      const probe = await load(wildcard);
      if (probe.result !== null) confusions.push(`${wildcard} → ${probe.result.pseudo}`);
      if (probe.calls[0]?.rows !== 0)
        leakingRows.push(`${wildcard} (${probe.calls[0]?.rows} ligne)`);
    }
  }
  check(
    'aucun pseudo à `_` ne se confond avec un voisin',
    confusions.length === 0,
    `${underscored.length} pseudos${confusions.length ? ` ; ${confusions.join(', ')}` : ''}`,
  );
  check(
    'la base rend zéro ligne pour un joker, sans filtre client',
    leakingRows.length === 0,
    leakingRows.join(', '),
  );

  // ─── Poids et latence ───────────────────────────────────────────────
  console.log('\n[poids et latence]');
  const medianBytes = percentile(sizes, 50);
  check(
    `charge utile médiane sous ${PAYLOAD_MEDIAN_BUDGET_BYTES} octets`,
    medianBytes < PAYLOAD_MEDIAN_BUDGET_BYTES,
    `${medianBytes} octets (min ${Math.min(...sizes)}, max ${Math.max(...sizes)})`,
  );
  const p50 = percentile(latencies, 50);
  check(
    `p50 sous ${LATENCY_P50_BUDGET_MS} ms`,
    p50 < LATENCY_P50_BUDGET_MS,
    `p50 ${p50.toFixed(0)} ms, p95 ${percentile(latencies, 95).toFixed(0)} ms, max ${Math.max(...latencies).toFixed(0)} ms`,
  );

  console.log(failures === 0 ? '\nTout est vert.' : `\n${failures} échec(s).`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
