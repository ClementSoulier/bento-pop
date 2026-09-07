#!/usr/bin/env node
/**
 * Dédoublonnage automatique du catalogue « Mon Bento Pop ».
 *
 * Ne fusionne QUE les doublons stricts : même catégorie, titres identiques
 * une fois neutralisés casse / accents / ponctuation / année entre
 * parenthèses, et aucun garde-fou déclenché (numérotation de franchise,
 * années contradictoires, sous-titres contradictoires). Tout ce qui est
 * seulement « proche » est laissé à la revue humaine (cf. `catalog-audit`).
 *
 * Pour chaque grappe :
 *   1. le canonique est choisi par heuristique (le plus référencé dans les
 *      bentos, puis illustré, puis complet, puis le plus ancien) ;
 *   2. `admin_merge_items` réécrit les `bento_items`, crée les alias et
 *      passe les perdants en `status='merged'` ;
 *   3. le canonique hérite de ce qui lui manque (image + crédit, année,
 *      sous-titre) et des alias des perdants.
 *
 * L'étape 3 est aussi faite côté SQL par la migration
 * `20260907000000_admin_merge_items_enrichment.sql` (pour que le bouton
 * « fusionner » du BO en profite). Tant que cette migration n'est pas
 * appliquée, c'est ce script qui comble ; une fois appliquée, l'étape est
 * un no-op. Dans les deux cas le résultat est le même.
 *
 * Usage (depuis la racine du monorepo) :
 *   pnpm --filter @bento-pop/admin catalog:merge              # dry-run
 *   pnpm --filter @bento-pop/admin catalog:merge -- --apply
 */

import {
  loadAdminEnv,
  createMobileRest,
  exactClusters,
  sameImageClusters,
  bestDisplayTitle,
} from './lib/catalog.mjs';

loadAdminEnv();

const APPLY = process.argv.includes('--apply');
// `--same-image` ajoute les items qui partagent la même illustration : deux
// affiches TMDb identiques dans la même catégorie désignent le même film,
// même quand les titres ne se ressemblent pas assez pour le seuil trigramme
// (« V pour Vendetta » / « V for Vendetta », 0.53). Hors défaut parce que le
// signal dépend d'images posées automatiquement, donc d'un état du catalogue
// plutôt que du seul contenu des items.
const SAME_IMAGE = process.argv.includes('--same-image');
const rest = createMobileRest();

const categories = await rest.selectAll('bento_categories', 'select=id,label_fr');
const catLabel = new Map(categories.map((c) => [c.id, c.label_fr]));

const items = await rest.selectAll(
  'items',
  'select=id,title,subtitle,year,image_url,image_credit,category_id,status,created_at&order=id.asc',
);
const bentoItems = await rest.selectAll('bento_items', 'select=item_id&order=item_id.asc');
const bentoCount = new Map();
for (const row of bentoItems) bentoCount.set(row.item_id, (bentoCount.get(row.item_id) ?? 0) + 1);
for (const item of items) item.bentoCount = bentoCount.get(item.id) ?? 0;

const alive = items.filter((i) => ['validated', 'pending', 'draft'].includes(i.status));
const clusters = exactClusters(alive);
if (SAME_IMAGE) {
  const covered = new Set(clusters.flatMap((c) => [c.canonical.id, ...c.losers.map((l) => l.id)]));
  for (const cluster of sameImageClusters(alive)) {
    const ids = [cluster.canonical.id, ...cluster.losers.map((l) => l.id)];
    if (ids.some((id) => covered.has(id))) continue; // déjà traité en doublon strict
    ids.forEach((id) => covered.add(id));
    clusters.push(cluster);
  }
}

if (clusters.length === 0) {
  console.log('Aucun doublon strict à fusionner. Rien à faire.');
  process.exit(0);
}

console.log(
  `\n${clusters.length} grappes · ${clusters.reduce((n, c) => n + c.losers.length, 0)} items à absorber` +
    `${APPLY ? '' : '  (DRY-RUN, rien ne sera écrit — ajoute --apply)'}\n`,
);

let merged = 0;
let inherited = 0;
let renamed = 0;

for (const cluster of clusters) {
  const { canonical, losers } = cluster;
  const rewrites = losers.reduce((n, l) => n + l.bentoCount, 0);
  console.log(
    `[${catLabel.get(canonical.category_id) ?? '?'}] « ${canonical.title} » ← ${losers.length} doublon(s)` +
      ` · ${rewrites} bento_items réécrits`,
  );
  for (const loser of losers) console.log(`    ← « ${loser.title} » (${loser.id.slice(0, 8)})`);

  // Ce dont le canonique hérite : uniquement les champs qu'il n'a PAS.
  // L'image et son crédit voyagent ensemble (un crédit orphelin serait faux).
  const patch = {};
  if (!canonical.image_url) {
    const donor = losers.find((l) => l.image_url);
    if (donor) {
      patch.image_url = donor.image_url;
      patch.image_credit = donor.image_credit ?? null;
    }
  }
  if (!canonical.year) {
    const donor = losers.find((l) => l.year);
    if (donor) patch.year = donor.year;
  }
  if (!canonical.subtitle) {
    const donor = losers.find((l) => l.subtitle && l.subtitle.trim());
    if (donor) patch.subtitle = donor.subtitle;
  }
  if (Object.keys(patch).length > 0) {
    console.log(`    ↑ hérite : ${Object.keys(patch).join(', ')}`);
  }

  // Les variantes ne diffèrent que par la casse et les accents : on garde
  // la mieux écrite comme titre affiché, l'ancienne devenant un alias.
  const displayTitle = bestDisplayTitle([canonical.title, ...losers.map((l) => l.title)]);
  const renames = displayTitle !== canonical.title;
  if (renames) console.log(`    ✎ titre : « ${canonical.title} » → « ${displayTitle} »`);

  if (!APPLY) continue;

  // 1. Fusion transactionnelle côté SQL (bento_items + alias + status).
  await rest.rpc('admin_merge_items', {
    canonical_id: canonical.id,
    loser_ids: losers.map((l) => l.id),
  });

  // 2. Héritage des champs manquants (no-op si la migration SQL v2 l'a
  //    déjà fait : on ne réécrit que ce qui est encore null).
  if (Object.keys(patch).length > 0) {
    const filter = `id=eq.${canonical.id}`;
    const fresh = await rest.selectAll('items', `select=id,image_url,year,subtitle&${filter}`);
    const current = fresh[0] ?? canonical;
    const remaining = {};
    if (patch.image_url && !current.image_url) {
      remaining.image_url = patch.image_url;
      remaining.image_credit = patch.image_credit;
    }
    if (patch.year && !current.year) remaining.year = patch.year;
    if (patch.subtitle && !current.subtitle) remaining.subtitle = patch.subtitle;
    if (Object.keys(remaining).length > 0) {
      await rest.patch('items', filter, remaining);
      inherited += 1;
    }
  }

  // 3. Les alias des perdants suivent le canonique (la fonction SQL v1 ne
  //    reprenait que leurs titres). `resolution=ignore-duplicates` couvre
  //    le cas où la migration v2 les a déjà copiés.
  const loserFilter = `item_id=in.(${losers.map((l) => l.id).join(',')})`;
  const loserAliases = await rest.selectAll('item_aliases', `select=alias&${loserFilter}`);
  const canonicalAliases = await rest.selectAll(
    'item_aliases',
    `select=alias&item_id=eq.${canonical.id}`,
  );
  const known = new Set(canonicalAliases.map((a) => a.alias));
  const toCopy = [...new Set(loserAliases.map((a) => a.alias))].filter(
    (alias) => !known.has(alias) && alias !== displayTitle,
  );
  if (renames) {
    await rest.patch('items', `id=eq.${canonical.id}`, { title: displayTitle });
    toCopy.push(canonical.title);
    renamed += 1;
  }

  if (toCopy.length > 0) {
    await rest.insert(
      'item_aliases',
      toCopy.map((alias) => ({ item_id: canonical.id, alias })),
      'return=minimal,resolution=ignore-duplicates',
      'item_id,alias',
    );
    console.log(`    + ${toCopy.length} alias`);
  }

  // `admin_merge_items` a inséré les titres des perdants comme alias : si
  // l'un d'eux est devenu le titre affiché, l'alias fait doublon.
  await rest.del(
    'item_aliases',
    `item_id=eq.${canonical.id}&alias=eq.${encodeURIComponent(displayTitle)}`,
  );

  merged += 1;
}

console.log(
  APPLY
    ? `\n${merged} grappes fusionnées · ${inherited} canoniques enrichis · ${renamed} titres recasés.\n`
    : '\nDry-run terminé. Relance avec --apply pour écrire.\n',
);
