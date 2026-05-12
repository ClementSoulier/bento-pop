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
 * ⚠ Utilise la SERVICE ROLE KEY (bypass RLS pour UPDATE). À NE JAMAIS commiter,
 * ne jamais embarquer dans l'app.
 *
 * Idempotent : ne touche que les rows où `image_url IS NULL`. Peut être
 * relancé en cas de coupure réseau.
 *
 * NB : on utilise `fetch` direct sur PostgREST plutôt que @supabase/supabase-js
 * — la lib instancie un RealtimeClient qui requiert WebSocket natif (absent
 * en Node 20). Le REST API suffit largement pour notre besoin.
 */

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

/**
 * Wrapper minimal autour de PostgREST :
 *   GET  /rest/v1/items?select=...&image_url=is.null&external_source=in.(...)
 *   PATCH /rest/v1/items?id=eq.<id>  Body: { image_url: "..." }
 */
function pgRest(baseUrl, serviceRoleKey) {
  const root = baseUrl.replace(/\/$/, '') + '/rest/v1';
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };
  return {
    async select(path) {
      const res = await fetch(`${root}/${path}`, { headers });
      if (!res.ok) throw new Error(`PostgREST SELECT failed: ${res.status} ${await res.text()}`);
      return res.json();
    },
    async update(path, body) {
      const res = await fetch(`${root}/${path}`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`PostgREST UPDATE failed: ${res.status} ${await res.text()}`);
    },
  };
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const db = pgRest(url, key);

  console.log('🔍 Fetching items without image_url…');
  const sources = SOURCES_TO_BACKFILL.map((s) => `"${s}"`).join(',');
  const items = await db.select(
    `items?select=id,title,external_source&image_url=is.null&external_source=in.(${sources})`,
  );

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
      try {
        await db.update(`items?id=eq.${item.id}`, { image_url: thumb });
        console.log('✓');
        hits++;
      } catch (e) {
        console.log(`⚠️  update failed: ${e.message}`);
        misses++;
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
