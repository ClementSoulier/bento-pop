#!/usr/bin/env node
/**
 * Rattrapage one-shot : repasse le `cacheControl` de tous les objets déjà
 * présents dans les buckets Storage à 1 an.
 *
 * Contexte : jusqu'ici les uploads posaient `max-age=3600` (défaut Supabase
 * ou valeur explicite dans `PhotoUploader`). Résultat, chaque visiteur de la
 * landing et chaque utilisateur de l'app mobile retéléchargeait toutes les
 * images une fois par heure, ce qui a fait sauter le quota d'egress du plan
 * gratuit (5,5 Go/mois). Le correctif côté code ne vaut que pour les NOUVEAUX
 * uploads : ce script traite le stock existant.
 *
 * L'API Storage n'expose pas de « patch metadata » : la seule façon de
 * changer le `cacheControl` est de ré-uploader l'objet. Le script télécharge
 * donc chaque fichier puis le repousse au même chemin en upsert. Le contenu
 * et l'URL publique sont inchangés, seuls les en-têtes bougent.
 *
 * Idempotent : les objets déjà à `max-age=31536000` sont sautés, donc une
 * seconde exécution ne consomme quasiment rien.
 *
 * Pourquoi l'API REST brute plutôt que `@supabase/supabase-js` : `createClient`
 * instancie un RealtimeClient, qui exige un WebSocket natif indisponible en
 * Node 20 (la version épinglée par `.nvmrc`) et fait planter le script au
 * démarrage. Ici tout passe par `fetch`, natif depuis Node 18, sans dépendance.
 *
 * Usage (depuis la racine du monorepo) :
 *   pnpm --filter @bento-pop/admin backfill:storage-cache -- --dry-run
 *   pnpm --filter @bento-pop/admin backfill:storage-cache
 *
 * Variables d'environnement (mêmes noms que le BO, cf. apps/admin/.env.example) :
 *   NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY        → team-photos, episode-media
 *   MOBILE_SUPABASE_URL      / MOBILE_SUPABASE_SERVICE_ROLE_KEY → item-images
 *
 * Le script charge automatiquement `apps/admin/.env.local` s'il existe.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CACHE_CONTROL_SECONDS = '31536000';
const TARGET_HEADER = `max-age=${CACHE_CONTROL_SECONDS}`;
const PAGE_SIZE = 100;
const CONCURRENCY = 4;

const DRY_RUN = process.argv.includes('--dry-run');

/* ------------------------------------------------------------------ env -- */

const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, '../.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, '');
  }
}

/** @type {Array<{ label: string, url?: string, key?: string, buckets: string[] }>} */
const PROJECTS = [
  {
    label: 'landing/admin',
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    buckets: ['team-photos', 'episode-media'],
  },
  {
    label: 'mobile',
    url: process.env.MOBILE_SUPABASE_URL,
    key: process.env.MOBILE_SUPABASE_SERVICE_ROLE_KEY,
    buckets: ['item-images'],
  },
];

/* --------------------------------------------------------------- helpers -- */

/** Client Storage minimal : les 3 appels REST dont on a besoin. */
function storageApi(baseUrl, serviceKey) {
  const root = `${baseUrl.replace(/\/$/, '')}/storage/v1`;
  const auth = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  };

  return {
    /** POST /object/list/{bucket} — paginé, non récursif. */
    async list(bucket, prefix, offset) {
      const response = await fetch(`${root}/object/list/${bucket}`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prefix,
          limit: PAGE_SIZE,
          offset,
          sortBy: { column: 'name', order: 'asc' },
        }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${(await response.text()).slice(0, 200)}`);
      }
      return response.json();
    },

    /** GET /object/{bucket}/{path} */
    async download(bucket, path) {
      const response = await fetch(`${root}/object/${bucket}/${encodePath(path)}`, {
        headers: auth,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${(await response.text()).slice(0, 200)}`);
      }
      return Buffer.from(await response.arrayBuffer());
    },

    /**
     * POST /object/{bucket}/{path} avec `x-upsert` : écrase l'objet existant.
     * C'est l'en-tête `cache-control` envoyé ici qui devient le `cacheControl`
     * stocké dans les metadata et resservi par le CDN.
     */
    async upsert(bucket, path, body, mimetype) {
      const response = await fetch(`${root}/object/${bucket}/${encodePath(path)}`, {
        method: 'POST',
        headers: {
          ...auth,
          'Content-Type': mimetype,
          'Cache-Control': TARGET_HEADER,
          'x-upsert': 'true',
        },
        body,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${(await response.text()).slice(0, 200)}`);
      }
    },
  };
}

/** Encode chaque segment sans échapper les `/` qui structurent le chemin. */
function encodePath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

/**
 * Liste récursivement tous les objets d'un bucket : les dossiers ressortent
 * avec `id === null` et doivent être parcourus à leur tour.
 *
 * @returns {Promise<Array<{ path: string, mimetype: string, cacheControl: string }>>}
 */
async function listAll(api, bucket, prefix = '') {
  const found = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let page;
    try {
      page = await api.list(bucket, prefix, offset);
    } catch (error) {
      throw new Error(`list ${bucket}/${prefix} : ${error.message}`);
    }
    if (!Array.isArray(page) || page.length === 0) return found;

    for (const entry of page) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null || entry.id === undefined) {
        found.push(...(await listAll(api, bucket, path)));
      } else {
        found.push({
          path,
          mimetype: entry.metadata?.mimetype ?? 'application/octet-stream',
          cacheControl: entry.metadata?.cacheControl ?? '',
        });
      }
    }

    if (page.length < PAGE_SIZE) return found;
  }
}

/** Exécute `worker` sur `items` avec au plus `CONCURRENCY` tâches en vol. */
async function mapLimit(items, worker) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
      await worker(item);
    }
  });
  await Promise.all(runners);
}

/* ------------------------------------------------------------------ main -- */

let totalRewritten = 0;
let totalSkipped = 0;
let totalBytes = 0;
let totalFailed = 0;

for (const project of PROJECTS) {
  if (!project.url || !project.key) {
    console.warn(`⚠️  Projet « ${project.label} » ignoré : URL ou service-role key absente.`);
    continue;
  }

  const api = storageApi(project.url, project.key);

  for (const bucket of project.buckets) {
    let objects;
    try {
      objects = await listAll(api, bucket);
    } catch (error) {
      console.error(`❌ ${project.label}/${bucket} : ${error.message}`);
      totalFailed += 1;
      continue;
    }

    const stale = objects.filter((o) => o.cacheControl !== TARGET_HEADER);
    totalSkipped += objects.length - stale.length;
    console.log(
      `\n📦 ${project.label}/${bucket} : ${objects.length} objet(s), ${stale.length} à corriger` +
        (DRY_RUN ? ' (dry-run)' : ''),
    );

    if (DRY_RUN) {
      for (const object of stale.slice(0, 10)) {
        console.log(`   · ${object.path} (${object.cacheControl || 'sans cacheControl'})`);
      }
      if (stale.length > 10) console.log(`   · … et ${stale.length - 10} autre(s)`);
      continue;
    }

    let done = 0;
    await mapLimit(stale, async (object) => {
      try {
        const body = await api.download(bucket, object.path);
        await api.upsert(bucket, object.path, body, object.mimetype);
        totalBytes += body.length;
        totalRewritten += 1;
        done += 1;
        process.stdout.write(`\r   ${done}/${stale.length} réécrit(s)…`);
      } catch (error) {
        totalFailed += 1;
        console.error(`\n   ❌ ${object.path} : ${error.message}`);
      }
    });
    if (stale.length > 0) process.stdout.write('\n');
  }
}

const mib = (totalBytes / 1024 / 1024).toFixed(1);
console.log(
  `\n${DRY_RUN ? 'Dry-run terminé' : 'Terminé'} : ${totalRewritten} réécrit(s), ` +
    `${totalSkipped} déjà à jour, ${totalFailed} en erreur, ${mib} Mio transférés.`,
);
process.exit(totalFailed > 0 ? 1 : 0);
