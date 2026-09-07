/**
 * Boîte à outils partagée par les scripts catalogue (`catalog-audit`,
 * `catalog-merge`, `catalog-images`).
 *
 * Trois responsabilités :
 *   1. Charger l'env du BO et parler au projet Supabase MOBILE en REST brut
 *      (même raison que `backfill-storage-cache.mjs` : `createClient`
 *      instancie un RealtimeClient qui casse sous Node 20).
 *   2. Normaliser les titres et calculer une similarité trigramme qui
 *      approxime `pg_trgm.similarity()` côté Postgres, pour raisonner sur
 *      les mêmes scores que `find_similar_items`.
 *   3. Détecter les doublons avec deux niveaux de confiance :
 *      - `exact`      : clés strictes identiques, fusionnable sans revue,
 *      - `suggestion` : proche mais pas identique, décision humaine.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/* ------------------------------------------------------------------ env -- */

/**
 * Charge `.env.local` puis `.env` d'`apps/admin` (le premier fichier qui
 * définit une variable gagne, et l'env du process gagne toujours).
 */
export function loadAdminEnv() {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const name of ['../../.env.local', '../../.env']) {
    const path = resolve(here, name);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) continue;
      process.env[key] = rawValue.trim().replace(/^["']|["']$/g, '');
    }
  }
}

/**
 * Token de lecture TMDb (v4 bearer). Cherché d'abord dans l'env du BO
 * (`TMDB_READ_TOKEN`), sinon dans `apps/mobile/.env` où vit déjà
 * `EXPO_PUBLIC_TMDB_TOKEN` : c'est le même token de lecture, et le
 * dupliquer serait une source de divergence.
 */
export function loadTmdbToken() {
  if (process.env.TMDB_READ_TOKEN) return process.env.TMDB_READ_TOKEN;
  const here = dirname(fileURLToPath(import.meta.url));
  const path = resolve(here, '../../../mobile/.env');
  if (!existsSync(path)) return null;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = /^\s*EXPO_PUBLIC_TMDB_TOKEN\s*=\s*(.*)$/.exec(line);
    if (match) return match[1].trim().replace(/^["']|["']$/g, '') || null;
  }
  return null;
}

/* -------------------------------------------------------------- postgrest -- */

/**
 * Petit client REST sur le projet Supabase mobile. Service-role, donc RLS
 * bypassée : on voit les items `pending` / `rejected` / `merged`.
 */
export function createMobileRest() {
  const url = process.env.MOBILE_SUPABASE_URL;
  const key = process.env.MOBILE_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'MOBILE_SUPABASE_URL / MOBILE_SUPABASE_SERVICE_ROLE_KEY manquants (cf. apps/admin/.env)',
    );
  }
  const base = url.replace(/\/+$/, '');
  const headers = {
    apikey: key,
    authorization: `Bearer ${key}`,
    'content-type': 'application/json',
  };

  /** SELECT paginé : PostgREST plafonne les réponses, on boucle par pages. */
  async function selectAll(table, query, pageSize = 1000) {
    const rows = [];
    for (let offset = 0; ; offset += pageSize) {
      const qs = `${query}&limit=${pageSize}&offset=${offset}`;
      const res = await fetch(`${base}/rest/v1/${table}?${qs}`, { headers });
      if (!res.ok) throw new Error(`GET ${table} → ${res.status} ${await res.text()}`);
      const page = await res.json();
      rows.push(...page);
      if (page.length < pageSize) return rows;
    }
  }

  async function rpc(fn, body) {
    const res = await fetch(`${base}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`RPC ${fn} → ${res.status} ${await res.text()}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  async function patch(table, filter, body) {
    const res = await fetch(`${base}/rest/v1/${table}?${filter}`, {
      method: 'PATCH',
      headers: { ...headers, prefer: 'return=minimal' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`PATCH ${table} → ${res.status} ${await res.text()}`);
  }

  async function del(table, filter) {
    const res = await fetch(`${base}/rest/v1/${table}?${filter}`, {
      method: 'DELETE',
      headers: { ...headers, prefer: 'return=minimal' },
    });
    if (!res.ok) throw new Error(`DELETE ${table} → ${res.status} ${await res.text()}`);
  }

  /**
   * INSERT, avec option d'ignorer les doublons. Attention : PostgREST
   * n'applique `resolution=ignore-duplicates` que si on lui dit sur QUELLE
   * contrainte porte le conflit, via `?on_conflict=col1,col2`. Sans ce
   * paramètre, un doublon sur une contrainte unique autre que la PK
   * remonte en 409, même avec le header `Prefer`.
   */
  async function insert(table, body, prefer = 'return=minimal', onConflict = null) {
    const qs = onConflict ? `?on_conflict=${onConflict}` : '';
    const res = await fetch(`${base}/rest/v1/${table}${qs}`, {
      method: 'POST',
      headers: { ...headers, prefer },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST ${table} → ${res.status} ${await res.text()}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  return { base, headers, selectAll, rpc, patch, insert, del };
}

/* ----------------------------------------------------------- normalisation -- */

const LEADING_ARTICLE = /^(le|la|les|l|un|une|des|du|de|the|a|an)\s+/;

/** Minuscule + sans accents + sans ponctuation, espaces compactés. */
export function foldText(s) {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’'`]/g, ' ')
    .replace(/&/g, ' et ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Clé STRICTE : ne neutralise que ce qui ne change jamais le sens (casse,
 * accents, ponctuation, année entre parenthèses, espaces). Deux items qui
 * partagent cette clé sont le même item, point. C'est la seule base sur
 * laquelle on fusionne sans revue humaine.
 */
export function strictKey(title) {
  return foldText((title ?? '').replace(/\((?:1[89]|20)\d{2}\)/g, ' '));
}

/**
 * Clé LARGE : en plus, retire l'article de tête. « The Office » et
 * « Office » se rejoignent, ce qui est souvent juste mais pas toujours
 * (« Le Bureau » n'est pas « Bureau »). Réservé aux suggestions.
 */
export function looseKey(title) {
  return strictKey(title).replace(LEADING_ARTICLE, '');
}

/* ------------------------------------------------------------- similarité -- */

/**
 * Trigrammes façon pg_trgm : découpage en mots, padding « __mot_ », 3-grammes.
 * Le score renvoyé par `similarity()` est un Jaccard sur ces ensembles ; on
 * reproduit la même formule pour rester cohérent avec les seuils SQL déjà
 * calibrés dans `find_similar_items` (0.25 admin / 0.4 user).
 */
export function trigramSet(s) {
  const words = foldText(s).split(' ').filter(Boolean);
  const set = new Set();
  for (const word of words) {
    const padded = `  ${word} `;
    for (let i = 0; i + 3 <= padded.length; i += 1) set.add(padded.slice(i, i + 3));
  }
  return set;
}

export function similarityOf(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return 0;
  let inter = 0;
  for (const gram of setA) if (setB.has(gram)) inter += 1;
  return inter / (setA.size + setB.size - inter);
}

export function similarity(a, b) {
  return similarityOf(trigramSet(a), trigramSet(b));
}

/* ---------------------------------------------------------- garde-fous -- */

// Chiffres romains pris en compte à partir de II. « i », « l », « c », « d »
// et « m » seuls sont exclus : ils viennent surtout d'élisions (« l'étranger »
// → token « l ») et créeraient de fausses divergences de numérotation.
const ROMAN = /^(ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii|xiii|xiv|xv)$/;

/**
 * Signature de numérotation d'un titre : « rocky 2 » → « 2 », « star wars
 * iii » → « 3 ». Deux titres proches mais de signature différente sont des
 * opus différents d'une même franchise, jamais un doublon.
 */
export function numericSignature(title) {
  const romanValues = {
    ii: 2,
    iii: 3,
    iv: 4,
    v: 5,
    vi: 6,
    vii: 7,
    viii: 8,
    ix: 9,
    x: 10,
    xi: 11,
    xii: 12,
    xiii: 13,
    xiv: 14,
    xv: 15,
  };
  return foldText(title)
    .split(' ')
    .filter(Boolean)
    .map((token) => {
      if (/^\d+$/.test(token)) return String(Number(token));
      if (ROMAN.test(token)) return String(romanValues[token]);
      return null;
    })
    .filter(Boolean)
    .join(',');
}

/**
 * Raison pour laquelle deux items NE peuvent PAS être considérés comme
 * doublons, ou `null` s'ils sont fusionnables. Appliqué aux deux niveaux
 * (exact ET suggestion) : un même titre avec deux années différentes est
 * un remake, pas un doublon.
 */
export function blockingReason(a, b) {
  if (a.category_id !== b.category_id) return 'catégories différentes';
  if (numericSignature(a.title) !== numericSignature(b.title)) return 'numérotation différente';
  if (a.year && b.year && a.year !== b.year) return `années différentes (${a.year} / ${b.year})`;
  const subA = foldText(a.subtitle);
  const subB = foldText(b.subtitle);
  if (subA && subB && subA !== subB && similarity(subA, subB) < 0.6) {
    return `sous-titres différents (${a.subtitle} / ${b.subtitle})`;
  }
  return null;
}

/* ------------------------------------------------------- choix du canonique -- */

/**
 * Ordonne les items d'une grappe du meilleur canonique au moins bon :
 * le plus utilisé dans les bentos d'abord (réécrire le moins de lignes
 * possible), puis celui qui a une image, puis le plus complet, puis le
 * plus ancien (l'item historique a déjà circulé).
 */
export function rankCanonical(items) {
  const score = (it) => [
    it.status === 'validated' ? 1 : 0,
    it.bentoCount ?? 0,
    it.image_url ? 1 : 0,
    (it.year ? 1 : 0) + (it.subtitle ? 1 : 0),
    -new Date(it.created_at ?? 0).getTime(),
  ];
  return [...items].sort((a, b) => {
    const sa = score(a);
    const sb = score(b);
    for (let i = 0; i < sa.length; i += 1) {
      if (sa[i] !== sb[i]) return sb[i] - sa[i];
    }
    return a.title.localeCompare(b.title);
  });
}

/* ------------------------------------------------------------ clustering -- */

/**
 * Grappes de doublons STRICTS : même catégorie, même clé stricte, aucun
 * garde-fou déclenché. C'est le lot « fusion automatique ».
 */
export function exactClusters(items) {
  const byKey = new Map();
  for (const item of items) {
    const key = `${item.category_id}::${strictKey(item.title)}`;
    if (!key.endsWith('::')) {
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(item);
    }
  }

  const clusters = [];
  for (const [key, group] of byKey) {
    if (group.length < 2) continue;
    const ranked = rankCanonical(group);
    const canonical = ranked[0];
    const losers = [];
    const blocked = [];
    for (const other of ranked.slice(1)) {
      const reason = blockingReason(canonical, other);
      if (reason) blocked.push({ item: other, reason });
      else losers.push(other);
    }
    if (losers.length > 0) clusters.push({ key, canonical, losers, blocked });
  }
  return clusters;
}

/**
 * Paires PROCHES mais pas identiques : `threshold <= score < 1` et aucun
 * garde-fou. Sortie triée par score décroissant, destinée à une revue
 * humaine (un clic par paire), jamais appliquée automatiquement.
 */
export function fuzzyPairs(items, threshold = 0.55) {
  const prepared = items.map((item) => ({
    item,
    grams: trigramSet(item.title),
    strict: strictKey(item.title),
    loose: looseKey(item.title),
  }));

  const byCategory = new Map();
  for (const entry of prepared) {
    if (!byCategory.has(entry.item.category_id)) byCategory.set(entry.item.category_id, []);
    byCategory.get(entry.item.category_id).push(entry);
  }

  const pairs = [];
  for (const group of byCategory.values()) {
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const a = group[i];
        const b = group[j];
        if (a.strict === b.strict) continue; // déjà traité en exact
        const score = a.loose === b.loose ? 1 : similarityOf(a.grams, b.grams);
        if (score < threshold) continue;
        if (blockingReason(a.item, b.item)) continue;
        pairs.push({ a: a.item, b: b.item, score, sameLooseKey: a.loose === b.loose });
      }
    }
  }
  return pairs.sort((x, y) => y.score - x.score);
}

/* --------------------------------------------------- meilleur libellé -- */

const SMALL_WORDS = new Set([
  'de',
  'du',
  'des',
  'le',
  'la',
  'les',
  'et',
  'a',
  'au',
  'aux',
  'en',
  'the',
  'of',
  'and',
]);

/**
 * Parmi des titres qui ne diffèrent que par la casse, les accents ou la
 * ponctuation (même `strictKey`), choisit celui à afficher : « Joueur du
 * Grenier » plutôt que « joueur du grenier ». Le titre est ce que voit
 * l'utilisateur dans son bento, donc la casse compte.
 *
 * Score : capitales en tête de mot significatif, accents conservés,
 * longueur (apostrophes et ponctuation d'origine) en dernier recours.
 */
export function bestDisplayTitle(titles) {
  const score = (title) => {
    const words = title.trim().split(/\s+/).filter(Boolean);
    let caps = 0;
    for (const word of words) {
      const first = word[0] ?? '';
      const isSmall = SMALL_WORDS.has(foldText(word));
      if (first === first.toUpperCase() && first !== first.toLowerCase() && !isSmall) caps += 1;
    }
    const startsUpper = /^[A-ZÀ-Ý]/.test(title.trim()) ? 1 : 0;
    const accents = (title.normalize('NFD').match(/[\u0300-\u036f]/g) ?? []).length;
    const allCaps = title === title.toUpperCase() && /[A-Z]/.test(title) ? -3 : 0;
    return [startsUpper + caps + allCaps, accents, title.trim().length];
  };
  return [...titles].sort((a, b) => {
    const sa = score(a);
    const sb = score(b);
    for (let i = 0; i < sa.length; i += 1) if (sa[i] !== sb[i]) return sb[i] - sa[i];
    return a.localeCompare(b);
  })[0];
}

/* ------------------------------------------- doublons par illustration -- */

/**
 * Grappes d'items d'une même catégorie qui partagent la MÊME illustration.
 *
 * Signal très fiable et gratuit depuis qu'on pose les images
 * automatiquement : deux items qui ont reçu la même affiche TMDb ou la même
 * photo Commons désignent la même œuvre. C'est ce qui rattrape les doublons
 * que la similarité de titre rate, comme « V pour Vendetta » et « V for
 * Vendetta » (0.53, sous le seuil).
 *
 * Les mêmes garde-fous que les doublons stricts s'appliquent : une
 * numérotation ou une année contradictoire l'emporte sur l'image partagée.
 */
export function sameImageClusters(items) {
  const byImage = new Map();
  for (const item of items) {
    if (!item.image_url) continue;
    // `?v=` est un cache-buster propre à chaque upload : deux copies de la
    // même image dans notre bucket ont des timestamps différents mais des
    // chemins identiques.
    const key = `${item.category_id}::${item.image_url.split('?')[0]}`;
    if (!byImage.has(key)) byImage.set(key, []);
    byImage.get(key).push(item);
  }

  const clusters = [];
  for (const group of byImage.values()) {
    if (group.length < 2) continue;
    const ranked = rankCanonical(group);
    const canonical = ranked[0];
    const losers = [];
    const blocked = [];
    for (const other of ranked.slice(1)) {
      const reason = blockingReason(canonical, other);
      if (reason) blocked.push({ item: other, reason });
      else losers.push(other);
    }
    if (losers.length > 0) clusters.push({ canonical, losers, blocked });
  }
  return clusters;
}
