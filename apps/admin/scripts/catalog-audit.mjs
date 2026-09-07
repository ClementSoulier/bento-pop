#!/usr/bin/env node
/**
 * Audit lecture seule du catalogue « Mon Bento Pop ».
 *
 * N'écrit RIEN : sert à savoir ce que `catalog-merge` fusionnerait et ce que
 * `catalog-images` irait chercher, avant de lancer quoi que ce soit.
 *
 * Sortie : un rapport lisible sur stdout + un JSON complet dans
 * `.context/catalog-audit.json` (gitignoré) pour les scripts suivants.
 *
 * Usage (depuis la racine du monorepo) :
 *   pnpm --filter @bento-pop/admin catalog:audit
 *   pnpm --filter @bento-pop/admin catalog:audit -- --threshold 0.5
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadAdminEnv,
  createMobileRest,
  exactClusters,
  fuzzyPairs,
  sameImageClusters,
} from './lib/catalog.mjs';

loadAdminEnv();

const argThreshold = process.argv.indexOf('--threshold');
const THRESHOLD = argThreshold > -1 ? Number(process.argv[argThreshold + 1]) : 0.55;

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '../../../.context/catalog-audit.json');

const rest = createMobileRest();

/* ----------------------------------------------------------- chargement -- */

const categories = await rest.selectAll(
  'bento_categories',
  'select=id,key,label_fr,display_order&order=display_order.asc',
);
const catById = new Map(categories.map((c) => [c.id, c]));

const items = await rest.selectAll(
  'items',
  'select=id,title,subtitle,year,image_url,image_credit,category_id,status,external_source,created_at&order=id.asc',
);

const bentoItems = await rest.selectAll('bento_items', 'select=item_id,bento_id&order=item_id.asc');
const bentoCount = new Map();
for (const row of bentoItems) {
  bentoCount.set(row.item_id, (bentoCount.get(row.item_id) ?? 0) + 1);
}
for (const item of items) item.bentoCount = bentoCount.get(item.id) ?? 0;

/* --------------------------------------------------------------- stats -- */

const byStatus = {};
for (const item of items) byStatus[item.status] = (byStatus[item.status] ?? 0) + 1;

const label = (id) => catById.get(id)?.label_fr ?? `#${id}`;
const fmt = (item) =>
  `${item.title}${item.year ? ` (${item.year})` : ''}${item.subtitle ? ` — ${item.subtitle}` : ''}`;

console.log('\n═══ Catalogue Mon Bento Pop ═══\n');
console.log(`Items totaux : ${items.length}`);
console.log(
  Object.entries(byStatus)
    .sort((a, b) => b[1] - a[1])
    .map(([status, n]) => `  ${status.padEnd(10)} ${n}`)
    .join('\n'),
);

console.log('\nPar catégorie (statut actif = draft/pending/validated) :');
for (const cat of categories) {
  const rows = items.filter(
    (i) => i.category_id === cat.id && i.status !== 'merged' && i.status !== 'rejected',
  );
  const noImage = rows.filter((i) => !i.image_url);
  const noImageUsed = noImage.filter((i) => i.bentoCount > 0);
  console.log(
    `  ${cat.label_fr.padEnd(22)} ${String(rows.length).padStart(5)} items` +
      ` · ${String(noImage.length).padStart(5)} sans image` +
      ` (dont ${noImageUsed.length} utilisés dans un bento)`,
  );
}

/* ------------------------------------------------------------ doublons -- */

// On ne dédoublonne que ce qui est encore vivant : un item déjà `merged` ou
// `rejected` ne doit pas repartir dans une grappe.
const alive = items.filter(
  (i) => i.status === 'validated' || i.status === 'pending' || i.status === 'draft',
);

const exact = exactClusters(alive);
const fuzzy = fuzzyPairs(alive, THRESHOLD);
const sameImage = sameImageClusters(alive);

const exactLosers = exact.reduce((n, c) => n + c.losers.length, 0);
const exactRewrites = exact.reduce(
  (n, c) => n + c.losers.reduce((m, l) => m + (l.bentoCount ?? 0), 0),
  0,
);

console.log(`\n─── Doublons stricts (fusion auto) ───`);
console.log(
  `${exact.length} grappes · ${exactLosers} items absorbés · ${exactRewrites} lignes bento_items réécrites\n`,
);
for (const cluster of exact.slice(0, 40)) {
  console.log(`  [${label(cluster.canonical.category_id)}] ${fmt(cluster.canonical)}`);
  console.log(
    `    canonique ${cluster.canonical.id.slice(0, 8)} (${cluster.canonical.status}, ${cluster.canonical.bentoCount} bento, ${cluster.canonical.image_url ? 'image' : 'sans image'})`,
  );
  for (const loser of cluster.losers) {
    console.log(
      `    ← ${fmt(loser)} · ${loser.id.slice(0, 8)} (${loser.status}, ${loser.bentoCount} bento, ${loser.image_url ? 'image' : 'sans image'})`,
    );
  }
  for (const b of cluster.blocked) console.log(`    ⊘ ${fmt(b.item)} · ${b.reason}`);
}
if (exact.length > 40) console.log(`  … ${exact.length - 40} grappes de plus (voir le JSON)`);

console.log(`\n─── Même illustration, donc probablement le même item ───`);
console.log(`${sameImage.length} grappes (fusionnables avec \`catalog:merge --same-image\`)\n`);
for (const cluster of sameImage) {
  console.log(`  [${label(cluster.canonical.category_id)}] ${fmt(cluster.canonical)}`);
  for (const loser of cluster.losers) console.log(`    ← ${fmt(loser)} · ${loser.id.slice(0, 8)}`);
  for (const b of cluster.blocked) console.log(`    ⊘ ${fmt(b.item)} · ${b.reason}`);
}

console.log(`\n─── Proches à revoir (score ≥ ${THRESHOLD}, décision humaine) ───`);
console.log(`${fuzzy.length} paires\n`);
for (const pair of fuzzy.slice(0, 40)) {
  console.log(
    `  ${pair.score.toFixed(2)} [${label(pair.a.category_id)}] ${fmt(pair.a)}  ⟷  ${fmt(pair.b)}` +
      (pair.sameLooseKey ? "  (identiques à l'article près)" : ''),
  );
}
if (fuzzy.length > 40) console.log(`  … ${fuzzy.length - 40} paires de plus (voir le JSON)`);

/* -------------------------------------------------------------- images -- */

const missingImage = alive.filter((i) => !i.image_url);
console.log(`\n─── Images ───`);
console.log(`${missingImage.length} items sans image sur ${alive.length} actifs`);
const credited = items.filter((i) => i.image_credit).length;
console.log(`${credited} items portent un crédit photo`);

/* ---------------------------------------------------------------- JSON -- */

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      threshold: THRESHOLD,
      totals: { items: items.length, byStatus },
      categories,
      exactClusters: exact.map((c) => ({
        canonicalId: c.canonical.id,
        canonicalTitle: c.canonical.title,
        categoryId: c.canonical.category_id,
        loserIds: c.losers.map((l) => l.id),
        loserTitles: c.losers.map((l) => l.title),
        bentoRewrites: c.losers.reduce((m, l) => m + (l.bentoCount ?? 0), 0),
        blocked: c.blocked.map((b) => ({ id: b.item.id, title: b.item.title, reason: b.reason })),
      })),
      sameImageClusters: sameImage.map((c) => ({
        canonicalId: c.canonical.id,
        canonicalTitle: c.canonical.title,
        loserIds: c.losers.map((l) => l.id),
        loserTitles: c.losers.map((l) => l.title),
      })),
      fuzzyPairs: fuzzy.map((p) => ({
        score: Number(p.score.toFixed(3)),
        categoryId: p.a.category_id,
        a: {
          id: p.a.id,
          title: p.a.title,
          year: p.a.year,
          bentoCount: p.a.bentoCount,
          hasImage: Boolean(p.a.image_url),
        },
        b: {
          id: p.b.id,
          title: p.b.title,
          year: p.b.year,
          bentoCount: p.b.bentoCount,
          hasImage: Boolean(p.b.image_url),
        },
      })),
      missingImages: missingImage.map((i) => ({
        id: i.id,
        title: i.title,
        categoryId: i.category_id,
        status: i.status,
        bentoCount: i.bentoCount,
      })),
    },
    null,
    2,
  ),
);
console.log(`\nRapport complet : ${OUT}\n`);
