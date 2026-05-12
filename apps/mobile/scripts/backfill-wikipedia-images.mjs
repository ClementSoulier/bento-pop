#!/usr/bin/env node
/**
 * Script ponctuel pour hydrater rétroactivement `items.image_url` avec
 * Wikipedia pour toutes les lignes créées AVANT l'arrivée de l'enrichissement
 * Wikipedia (artistes / créateurs / lieux).
 *
 * Usage :
 *   cd apps/mobile
 *   SUPABASE_URL="https://xxx.supabase.co" \
 *   SUPABASE_SERVICE_ROLE_KEY="eyJ..." \
 *   node scripts/backfill-wikipedia-images.mjs
 *
 * ⚠ Utilise la SERVICE ROLE KEY (pas l'anon) — bypass RLS pour UPDATE en
 * masse. À NE JAMAIS commiter, ne jamais embarquer dans l'app.
 *
 * Idempotent : ne touche que les rows où `image_url IS NULL`. Peut être
 * relancé en cas de coupure réseau.
 */

import { createClient } from '@supabase/supabase-js';

const USER_AGENT = 'BentoPop-Backfill/0.1 (https://bento-pop.com)';
const SOURCES_TO_BACKFILL = ['musicbrainz', 'wikidata', 'osm'];
const RATE_LIMIT_MS = 100; // ~10 req/s, large sous les limites Wikipedia

async function fetchWikipediaThumb(title) {
  for (const lang of ['fr', 'en']) {
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.trim())}`;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data.type === 'disambiguation') continue;
      if (data.thumbnail?.source) return data.thumbnail.source;
    } catch (e) {
      // skip, try next lang
    }
  }
  return null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log('🔍 Fetching items without image_url…');
  const { data: items, error } = await supabase
    .from('items')
    .select('id, title, external_source')
    .is('image_url', null)
    .in('external_source', SOURCES_TO_BACKFILL);

  if (error) {
    console.error('❌ Query failed:', error.message);
    process.exit(1);
  }
  if (!items || items.length === 0) {
    console.log('✅ Aucun item à backfiller — tout est à jour.');
    return;
  }

  console.log(`📋 ${items.length} item(s) à traiter`);
  let hits = 0;
  let misses = 0;

  for (const [i, item] of items.entries()) {
    process.stdout.write(`[${i + 1}/${items.length}] "${item.title}" (${item.external_source})… `);
    const thumb = await fetchWikipediaThumb(item.title);
    if (thumb) {
      const { error: upErr } = await supabase
        .from('items')
        .update({ image_url: thumb })
        .eq('id', item.id);
      if (upErr) {
        console.log(`⚠️  update failed: ${upErr.message}`);
        misses++;
      } else {
        console.log('✓');
        hits++;
      }
    } else {
      console.log('— pas de page Wikipedia');
      misses++;
    }
    await sleep(RATE_LIMIT_MS);
  }

  console.log(`\n✅ Terminé : ${hits} hydratés / ${misses} sans match / ${items.length} total`);
}

main().catch((e) => {
  console.error('💥 Fatal:', e);
  process.exit(1);
});
