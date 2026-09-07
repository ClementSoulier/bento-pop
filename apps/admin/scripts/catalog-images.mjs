#!/usr/bin/env node
/**
 * Enrichissement automatique des illustrations du catalogue depuis
 * Wikipedia / Wikimedia Commons.
 *
 * Pour chaque item actif sans `image_url` (les plus utilisés dans les bentos
 * d'abord) :
 *   1. recherche Wikipedia FR puis EN, avec un indice de catégorie ajouté à
 *      la requête (« Seven film » plutôt que « Seven ») ;
 *   2. les candidats sont typés via la description Wikidata (« film de
 *      Christopher Nolan », « vidéaste web française », « commune de
 *      France ») : c'est ce qui écarte les homonymes ;
 *   3. l'image est prise UNIQUEMENT si le fichier est hébergé sur Wikimedia
 *      Commons. Commons n'accepte que du réutilisable ; les affiches de
 *      films sur en.wikipedia sont des fichiers locaux en fair-use, donc
 *      non réutilisables, et sont écartées de fait ;
 *   4. si titre + type + licence concordent, l'image est téléchargée en
 *      800px, poussée dans `item-images/{id}/main.ext` et l'item reçoit
 *      `image_url` + `image_credit` ;
 *   5. sinon les meilleurs candidats sont écrits dans
 *      `item_image_suggestions` (status `pending`) pour la revue admin.
 *
 * Usage (depuis la racine du monorepo) :
 *   pnpm --filter @bento-pop/admin catalog:images -- --limit 10   # dry-run
 *   pnpm --filter @bento-pop/admin catalog:images -- --apply
 *   pnpm --filter @bento-pop/admin catalog:images -- --apply --category film
 *   pnpm --filter @bento-pop/admin catalog:images -- --rehost --apply
 *
 * Mode `--rehost` : ne cherche rien, mais rapatrie dans notre bucket les
 * images qui pointent encore directement sur upload.wikimedia.org (héritage
 * de l'époque des APIs externes) et leur pose le crédit qui manquait. Deux
 * raisons : Wikimedia demande de ne pas être hotlinké par une app, et une
 * image CC BY-SA affichée sans attribution n'est pas en règle.
 */

import {
  loadAdminEnv,
  loadTmdbToken,
  createMobileRest,
  foldText,
  similarity,
} from './lib/catalog.mjs';

loadAdminEnv();

const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i > -1 ? (argv[i + 1] ?? fallback) : fallback;
};
const APPLY = argv.includes('--apply');
const REHOST = argv.includes('--rehost');
const LIMIT = Number(flag('limit', '0')) || Infinity;
const ONLY_CATEGORY = flag('category');
const THUMB_WIDTH = 800;
// Aligné sur `STORAGE_CACHE_CONTROL` (src/lib/storage.ts) : 1 an.
const STORAGE_CACHE_CONTROL = '31536000';
const USER_AGENT =
  'BentoPopAdmin/1.0 (https://bento-pop.com; contact@keremaprod.com) catalog-images';

// Seuil de ressemblance titre item / titre de page Wikipedia au-dessus
// duquel on considère qu'on parle bien de la même œuvre.
const TITLE_MATCH = 0.75;

// TMDb : source des affiches de films et séries, que Wikimedia ne peut pas
// fournir légalement. Le token de lecture est celui de l'app mobile.
const TMDB_TOKEN = loadTmdbToken();
const TMDB_API = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p/w500';
// Attribution TMDb : leurs CGU demandent de citer la source. La mention
// complète (« this product uses the TMDB API but is not endorsed... ») vit
// dans l'écran Crédits de l'app, ici on crédite juste le visuel.
const TMDB_CREDIT = 'Affiche : The Movie Database (TMDb)';

/* ------------------------------------------------------- règles par type -- */

/**
 * Pour chaque catégorie : l'indice ajouté à la recherche Wikipedia, et le
 * motif que doit matcher la description Wikidata du candidat. Les motifs
 * sont volontairement larges côté vocabulaire mais stricts côté domaine :
 * un « film » ne doit jamais illustrer un « lieu ».
 */
const CATEGORY_RULES = {
  // film / série : l'affiche n'est JAMAIS libre (fair use sur en.wikipedia,
  // interdite sur fr), donc ce que Commons propose pour ces pages est une
  // image de substitution : photo de cosplay, lieu de tournage, ou pire un
  // homonyme tombé dans le domaine public (« Braveheart » renvoyait le film
  // de 1925, pas celui de 1995). Mesuré : 3 auto-acceptations sur 10 films,
  // dont 2 fausses.
  //
  // Ces deux catégories passent donc par TMDb (`source: 'tmdb'`), dont les
  // affiches sont réutilisables avec attribution. Sans token TMDb, on
  // retombe sur Wikipedia en revue manuelle uniquement (`auto: false`).
  film: {
    hint: 'film',
    type: /\bfilms?\b|long metrage|court metrage|movie|cinema/,
    auto: false,
    source: 'tmdb',
    tmdbPath: '/search/movie',
  },
  series: {
    hint: 'série télévisée',
    type: /serie|series|anime\b|feuilleton|sitcom|emission/,
    auto: false,
    source: 'tmdb',
    tmdbPath: '/search/tv',
  },
  artist: {
    hint: 'musique',
    type: /groupe|band\b|duo|chanteur|chanteuse|musicien|musicienne|rappeur|rappeuse|compositeur|compositrice|auteur compositeur|interprete|dj\b|orchestre|singer|musician|rapper|producteur de musique/,
  },
  track: {
    hint: 'chanson',
    type: /chanson|single|\bsong\b|morceau|composition musicale|oeuvre musicale|titre de/,
  },
  creator: {
    hint: 'vidéaste web',
    type: /videaste|youtube|youtubeur|youtubeuse|streamer|streameuse|twitch|influenceur|influenceuse|humoriste|animateur|animatrice|createur de contenu|createur web|podcast|internet personality|web/,
  },
  place: {
    hint: '',
    type: /ville|commune|pays|capitale|etat|region|\bile\b|village|province|departement|quartier|prefecture|municipalite|city|country|island|monument|parc|site|lieu|station|massif|montagne|lac|plage|archipel/,
  },
};

/* -------------------------------------------------------------- helpers -- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Appel API Wikimedia avec retry : sur un batch de plusieurs centaines
 * d'items, un `fetch failed` isolé (DNS, coupure TLS, throttling) est
 * inévitable et ne doit pas coûter l'item.
 */
async function wikiJson(url, attempt = 1) {
  try {
    const res = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
    if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
    if (!res.ok) throw new Error(`${res.status} sur ${url}`);
    return await res.json();
  } catch (e) {
    if (attempt >= 3) throw new Error(`${e.cause?.message ?? e.message}`);
    await sleep(400 * attempt * attempt);
    return wikiJson(url, attempt + 1);
  }
}

/** Retire le désambiguïsateur : « Seven (film) » → « Seven ». */
function stripQualifier(pageTitle) {
  return pageTitle.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

/**
 * Résultats de recherche + vignette + QID Wikidata, en 2 appels pour 10
 * pages. `pithumbsize` demande directement la vignette à la bonne largeur.
 */
async function searchPages(lang, query) {
  const api = `https://${lang}.wikipedia.org/w/api.php`;
  const search = await wikiJson(
    `${api}?${new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: query,
      srlimit: '8',
      format: 'json',
      origin: '*',
    })}`,
  );
  const titles = (search.query?.search ?? []).map((s) => s.title);
  if (titles.length === 0) return [];

  const pages = await wikiJson(
    `${api}?${new URLSearchParams({
      action: 'query',
      titles: titles.join('|'),
      prop: 'pageimages|pageprops|info',
      pithumbsize: String(THUMB_WIDTH),
      inprop: 'url',
      format: 'json',
      origin: '*',
    })}`,
  );
  const byTitle = new Map(Object.values(pages.query?.pages ?? {}).map((p) => [p.title, p]));

  return titles
    .map((title, rank) => {
      const page = byTitle.get(title);
      if (!page) return null;
      return {
        rank,
        lang,
        title,
        url: page.fullurl ?? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`,
        fileName: page.pageimage ?? null,
        thumbnail: page.thumbnail?.source ?? null,
        qid: page.pageprops?.wikibase_item ?? null,
      };
    })
    .filter(Boolean);
}

/** Descriptions Wikidata (fr, sinon en) pour un lot de QID : 1 seul appel. */
async function describeEntities(qids) {
  const out = new Map();
  if (qids.length === 0) return out;
  const data = await wikiJson(
    `https://www.wikidata.org/w/api.php?${new URLSearchParams({
      action: 'wbgetentities',
      ids: qids.join('|'),
      props: 'descriptions',
      languages: 'fr|en',
      format: 'json',
      origin: '*',
    })}`,
  );
  for (const [qid, entity] of Object.entries(data.entities ?? {})) {
    const fr = entity.descriptions?.fr?.value ?? '';
    const en = entity.descriptions?.en?.value ?? '';
    out.set(qid, { fr, en, folded: foldText(`${fr} ${en}`) });
  }
  return out;
}

/**
 * Métadonnées du fichier SUR COMMONS. Si le fichier n'y existe pas, c'est
 * un fichier local (fair-use en.wikipedia le plus souvent) : on renvoie
 * null et le candidat est écarté. C'est notre filtre de licence.
 */
async function commonsFile(fileName) {
  const data = await wikiJson(
    `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({
      action: 'query',
      titles: `File:${fileName}`,
      prop: 'imageinfo',
      iiprop: 'extmetadata|url|mime',
      iiurlwidth: String(THUMB_WIDTH),
      format: 'json',
      origin: '*',
    })}`,
  );
  const page = Object.values(data.query?.pages ?? {})[0];
  if (!page || page.missing !== undefined) return null;
  const info = page.imageinfo?.[0];
  if (!info) return null;

  const meta = info.extmetadata ?? {};
  const license = (meta.LicenseShortName?.value ?? meta.License?.value ?? '').trim();
  const licenseCode = (meta.License?.value ?? '').trim().toLowerCase();
  // Ceinture/bretelle : Commons est censé être 100 % libre, mais on refuse
  // explicitement tout ce qui se déclare non-libre.
  if (/fair use|non-free|nonfree/i.test(`${license} ${licenseCode}`)) return null;

  const author = stripHtml(meta.Artist?.value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  const attribution = author
    ? `Photo : ${author}${license ? ` (${license})` : ''}, via Wikimedia Commons`
    : license
      ? `Wikimedia Commons (${license})`
      : 'Wikimedia Commons';

  return {
    // `thumburl` est le rendu à la largeur demandée, y compris pour les SVG
    // (converti en PNG) : c'est ce qu'on stocke, pas l'original full-res.
    sourceUrl: info.thumburl ?? info.url,
    thumbnailUrl: info.thumburl ?? info.url,
    descriptionUrl: info.descriptionurl ?? null,
    mime: info.thumbmime ?? info.mime ?? 'image/jpeg',
    attribution,
    licenseCode: licenseCode || null,
  };
}

function stripHtml(s) {
  return s.replace(/<[^>]+>/g, ' ');
}

/* ------------------------------------------------------------ scoring -- */

/**
 * Décide si un candidat illustre bien l'item. Renvoie le détail du calcul
 * pour que le rapport explique ses refus.
 */
function judge(item, candidate, description, rule) {
  // Une année dans la description qui contredit celle de l'item = autre
  // œuvre (remake, homonyme). « Braveheart » 1995 ≠ « Braveheart » 1925.
  const descYears = [...(description?.folded ?? '').matchAll(/\b(?:1[89]|20)\d{2}\b/g)].map(Number);
  const yearOk = !item.year || descYears.length === 0 || descYears.includes(item.year);
  const titleScore = Math.max(
    similarity(stripQualifier(candidate.title), item.title),
    foldText(stripQualifier(candidate.title)) === foldText(item.title) ? 1 : 0,
  );
  const desc = description?.folded ?? '';
  const typeOk = desc ? rule.type.test(desc) : false;

  // Si l'item porte un sous-titre significatif (l'artiste d'une chanson,
  // le pays d'un lieu), la description Wikidata doit le corroborer.
  const subtitleTokens = foldText(item.subtitle ?? '')
    .split(' ')
    .filter((t) => t.length >= 4);
  const subtitleOk =
    subtitleTokens.length === 0 || !desc || subtitleTokens.some((t) => desc.includes(t));

  return {
    titleScore,
    typeOk,
    subtitleOk,
    yearOk,
    hasDescription: Boolean(desc),
    auto: rule.auto !== false && titleScore >= TITLE_MATCH && typeOk && subtitleOk && yearOk,
  };
}

/* ------------------------------------------------------------- pipeline -- */

const rest = createMobileRest();

const categories = await rest.selectAll('bento_categories', 'select=id,key,label_fr');
const catById = new Map(categories.map((c) => [c.id, c]));

if (REHOST) {
  await runRehost();
  process.exit(0);
}

/**
 * Rapatriement des images encore hébergées chez Wikimedia.
 *
 * Les URL `upload.wikimedia.org` portent le nom du fichier, ce qui permet de
 * retrouver sa fiche Commons, donc son auteur et sa licence : on récupère au
 * passage le crédit qui manquait. Les fichiers servis depuis un wiki local
 * (`/wikipedia/fr/`, `/wikipedia/en/`) ne sont PAS sur Commons : ce sont des
 * fichiers non libres, on ne les rapatrie pas, on les signale.
 */
async function runRehost() {
  const withImages = await rest.selectAll(
    'items',
    'select=id,title,image_url,image_credit,category_id,status&image_url=not.is.null&order=id.asc',
  );
  const targets = withImages.filter(
    (i) =>
      i.status !== 'merged' &&
      i.status !== 'rejected' &&
      /^https:\/\/upload\.wikimedia\.org\//.test(i.image_url),
  );

  console.log(
    `\n${targets.length} images hébergées chez Wikimedia à rapatrier` +
      `${APPLY ? '' : '  (DRY-RUN, aucune écriture — ajoute --apply)'}\n`,
  );

  let moved = 0;
  let nonFree = 0;
  let failed = 0;

  for (const item of targets) {
    const label = `[${catById.get(item.category_id)?.label_fr ?? '?'}] ${item.title}`;
    const path = decodeURIComponent(new URL(item.image_url).pathname);
    // .../commons/thumb/4/4b/Fichier.jpg/330px-Fichier.jpg  → « Fichier.jpg »
    // .../commons/4/4b/Fichier.jpg                          → « Fichier.jpg »
    const match = /\/wikipedia\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/]+)/.exec(path);
    if (!match) {
      console.log(
        `⊘ ${label} → fichier local non libre (${path.split('/')[2] ?? '?'}), laissé tel quel`,
      );
      nonFree += 1;
      continue;
    }

    try {
      const file = await commonsFile(match[1]);
      if (!file) {
        console.log(`⊘ ${label} → introuvable sur Commons, laissé tel quel`);
        nonFree += 1;
        continue;
      }
      console.log(`↓ ${label}\n    ${file.attribution}`);
      if (APPLY) {
        await applyImage(
          rest,
          item,
          file.descriptionUrl ?? `https://commons.wikimedia.org/wiki/File:${match[1]}`,
          file,
        );
      }
      moved += 1;
    } catch (e) {
      console.log(`! ${label} → ${e.message}`);
      failed += 1;
    }
    await sleep(150);
  }

  // Crédits manquants sur les images hotlinkées qu'on ne rapatrie pas : les
  // affiches TMDb (leur CDN est fait pour ça) et les pochettes Cover Art
  // Archive. Elles étaient affichées sans attribution, ce que les CGU des
  // deux services interdisent.
  const uncredited = withImages.filter((i) => !i.image_credit);
  const hotlinkCredits = [
    { host: 'image.tmdb.org', credit: TMDB_CREDIT },
    { host: 'coverartarchive.org', credit: 'Pochette : Cover Art Archive (MusicBrainz)' },
  ];
  for (const { host, credit } of hotlinkCredits) {
    const rows = uncredited.filter((i) => i.image_url.includes(host));
    if (rows.length === 0) continue;
    console.log(`\n+ ${rows.length} crédits « ${credit} » à poser (${host})`);
    if (APPLY) {
      await rest.patch('items', `id=in.(${rows.map((r) => r.id).join(',')})`, {
        image_credit: credit,
      });
    }
  }

  console.log(
    `\n${moved} images rapatriées et créditées · ${nonFree} laissées (non libres ou absentes de Commons)` +
      ` · ${failed} en erreur${APPLY ? '' : '\nDry-run : relance avec --apply pour écrire.'}\n`,
  );
}

const items = await rest.selectAll(
  'items',
  'select=id,title,subtitle,year,image_url,category_id,status&image_url=is.null&order=id.asc',
);
const bentoItems = await rest.selectAll('bento_items', 'select=item_id&order=item_id.asc');
const bentoCount = new Map();
for (const row of bentoItems) bentoCount.set(row.item_id, (bentoCount.get(row.item_id) ?? 0) + 1);

const queue = items
  .filter((i) => ['validated', 'pending', 'draft'].includes(i.status))
  .filter((i) => !ONLY_CATEGORY || catById.get(i.category_id)?.key === ONLY_CATEGORY)
  .map((i) => ({ ...i, bentoCount: bentoCount.get(i.id) ?? 0 }))
  .sort((a, b) => b.bentoCount - a.bentoCount || a.title.localeCompare(b.title))
  .slice(0, LIMIT === Infinity ? undefined : LIMIT);

console.log(
  `\n${queue.length} items sans image à traiter` +
    `${APPLY ? '' : '  (DRY-RUN, aucune écriture — ajoute --apply)'}\n`,
);

const stats = { auto: 0, suggested: 0, nothing: 0, failed: 0 };

for (const item of queue) {
  const category = catById.get(item.category_id);
  const rule = CATEGORY_RULES[category?.key] ?? { hint: '', type: /.*/ };
  const label = `[${category?.label_fr ?? '?'}] ${item.title}${item.subtitle ? ` · ${item.subtitle}` : ''}`;
  const viaTmdb = rule.source === 'tmdb' && TMDB_TOKEN;

  try {
    const { accepted, fallbacks } = viaTmdb
      ? await collectTmdbCandidates(item, rule)
      : await collectWikimediaCandidates(item, rule);

    if (accepted) {
      const { page, file, verdict } = accepted;
      console.log(
        `✔ ${label}\n    ${page.title} (${page.lang}) · titre ${verdict.titleScore.toFixed(2)}` +
          ` · ${accepted.description?.fr || accepted.description?.en || 'sans description'}`,
      );
      console.log(`    ${file.attribution}`);
      stats.auto += 1;
      if (APPLY) await applyImage(rest, item, page.url, file);
    } else if (fallbacks.length > 0) {
      console.log(`? ${label}  → ${fallbacks.length} suggestion(s) à trancher en BO`);
      for (const c of fallbacks.slice(0, 3)) {
        console.log(`    · ${c.page.title} (${c.page.lang}) — ${rejectionReason(c.verdict, rule)}`);
      }
      stats.suggested += 1;
      if (APPLY) await saveSuggestions(rest, item, fallbacks.slice(0, 3));
    } else {
      console.log(`✗ ${label}  → aucun candidat exploitable`);
      stats.nothing += 1;
    }
  } catch (e) {
    console.log(`! ${label}  → ${e.message}`);
    stats.failed += 1;
  }

  await sleep(150);
}

/** Explique en un mot pourquoi un candidat n'a pas été posé tout seul. */
function rejectionReason(verdict, rule) {
  if (!verdict.typeOk) return verdict.hasDescription ? 'type incohérent' : 'type invérifiable';
  if (!verdict.yearOk) return 'année contradictoire';
  if (!verdict.subtitleOk) return 'sous-titre non corroboré';
  if (verdict.titleScore < TITLE_MATCH) return `titre ${verdict.titleScore.toFixed(2)}`;
  if (rule.auto === false) return 'catégorie en revue manuelle';
  return `titre ${verdict.titleScore.toFixed(2)}`;
}

/**
 * Candidats Wikipedia / Commons. Deux passes de recherche : avec l'indice de
 * catégorie (meilleure désambiguïsation), puis sans (certains titres exacts
 * sortent mieux seuls). FR d'abord, EN ensuite : notre public est
 * francophone mais beaucoup de créateurs et de lieux n'ont qu'une page EN.
 */
async function collectWikimediaCandidates(item, rule) {
  const attempts = [];
  for (const lang of ['fr', 'en']) {
    if (rule.hint) attempts.push([lang, `${item.title} ${rule.hint}`]);
    attempts.push([lang, item.title]);
  }

  let accepted = null;
  const fallbacks = [];
  const seenTitles = new Set();

  for (const [lang, query] of attempts) {
    if (accepted) break;
    const pages = (await searchPages(lang, query)).filter((p) => p.thumbnail && p.fileName);
    const fresh = pages.filter((p) => !seenTitles.has(`${lang}:${p.title}`));
    fresh.forEach((p) => seenTitles.add(`${lang}:${p.title}`));
    if (fresh.length === 0) continue;

    const descriptions = await describeEntities([
      ...new Set(fresh.map((p) => p.qid).filter(Boolean)),
    ]);

    for (const page of fresh.slice(0, 4)) {
      const verdict = judge(item, page, descriptions.get(page.qid), rule);
      // Le fichier Commons n'est demandé que pour les candidats qui ont une
      // chance : c'est l'appel le plus coûteux.
      if (verdict.titleScore < 0.45) continue;
      const file = await commonsFile(page.fileName);
      if (!file) continue;

      const candidate = { page, file, verdict, description: descriptions.get(page.qid) };
      if (verdict.auto) {
        accepted = candidate;
        break;
      }
      fallbacks.push(candidate);
    }
    await sleep(120);
  }

  return { accepted, fallbacks };
}

/**
 * Candidats TMDb pour un film ou une série.
 *
 * Deux différences avec Wikipedia : le type ne pose jamais question (on
 * interroge `/search/movie` ou `/search/tv`, donc un résultat est forcément
 * du bon type), et l'année est fiable, donc c'est elle qui départage les
 * homonymes et les remakes.
 *
 * L'affiche reste servie par le CDN TMDb plutôt que copiée dans notre
 * bucket : c'est ce que font déjà les items historiques, c'est prévu pour
 * par TMDb, et ça évite de payer l'egress Supabase sur des images qui ne
 * nous appartiennent pas.
 */
async function collectTmdbCandidates(item, rule) {
  let results = await tmdbSearch(
    rule.tmdbPath,
    item.title,
    item.year,
    rule.tmdbPath.endsWith('tv'),
  );
  // Le filtre par année est strict côté TMDb : si rien ne sort, on retente
  // sans, quitte à ce que le contrôle d'année se fasse ensuite côté score.
  if (results.length === 0 && item.year) {
    results = await tmdbSearch(rule.tmdbPath, item.title, null, rule.tmdbPath.endsWith('tv'));
  }

  let accepted = null;
  const fallbacks = [];

  for (const result of results.slice(0, 4)) {
    if (!result.posterPath) continue;
    const titleScore = Math.max(
      similarity(result.title, item.title),
      similarity(result.originalTitle ?? '', item.title),
      foldText(result.title) === foldText(item.title) ? 1 : 0,
    );
    // Une année d'écart est tolérée : TMDb date sur la sortie salle, nos
    // items sur ce dont l'utilisateur se souvient.
    const yearOk = !item.year || !result.year || Math.abs(result.year - item.year) <= 1;
    const verdict = {
      titleScore,
      typeOk: true,
      subtitleOk: true,
      yearOk,
      hasDescription: Boolean(result.overview),
      auto: titleScore >= TITLE_MATCH && yearOk,
    };
    const candidate = {
      page: {
        title: `${result.title}${result.year ? ` (${result.year})` : ''}`,
        lang: 'tmdb',
        url: `https://www.themoviedb.org/${rule.tmdbPath.endsWith('tv') ? 'tv' : 'movie'}/${result.id}`,
      },
      file: {
        sourceUrl: `${TMDB_IMG}${result.posterPath}`,
        thumbnailUrl: `${TMDB_IMG}${result.posterPath}`,
        attribution: TMDB_CREDIT,
        licenseCode: 'tmdb',
        mime: 'image/jpeg',
        // Pas de rapatriement : on garde l'URL du CDN TMDb telle quelle.
        hotlink: true,
      },
      verdict,
      description: { fr: result.overview?.slice(0, 90) ?? '', en: '' },
    };
    if (verdict.auto) {
      accepted = candidate;
      break;
    }
    fallbacks.push(candidate);
  }

  return { accepted, fallbacks };
}

/** Un appel `/search/*` TMDb, normalisé en candidats comparables. */
async function tmdbSearch(path, query, year, isSeries) {
  const params = new URLSearchParams({
    query,
    language: 'fr-FR',
    include_adult: 'false',
    page: '1',
  });
  if (year) params.set(isSeries ? 'first_air_date_year' : 'primary_release_year', String(year));

  const res = await fetch(`${TMDB_API}${path}?${params}`, {
    headers: { authorization: `Bearer ${TMDB_TOKEN}`, accept: 'application/json' },
  });
  if (res.status === 401) throw new Error('TMDb 401 : token invalide');
  if (!res.ok) throw new Error(`TMDb ${res.status}`);
  const data = await res.json();

  return (data.results ?? []).map((r) => {
    const date = isSeries ? r.first_air_date : r.release_date;
    return {
      id: r.id,
      title: (isSeries ? r.name : r.title) ?? '',
      originalTitle: isSeries ? r.original_name : r.original_title,
      year: date ? Number(date.slice(0, 4)) : null,
      posterPath: r.poster_path ?? null,
      overview: r.overview ?? '',
    };
  });
}

console.log(
  `\n${stats.auto} illustrés automatiquement · ${stats.suggested} à trancher en BO · ` +
    `${stats.nothing} sans candidat · ${stats.failed} en erreur` +
    `${APPLY ? '' : '\nDry-run : relance avec --apply pour écrire.'}\n`,
);

/* ------------------------------------------------------------ écritures -- */

async function applyImage(rest, item, pageUrl, file) {
  // Cas TMDb : l'affiche reste servie par leur CDN, on ne stocke que l'URL.
  if (file.hotlink) {
    await rest.patch('items', `id=eq.${item.id}`, {
      image_url: file.sourceUrl,
      image_credit: file.attribution,
    });
    await traceSuggestion(rest, item, pageUrl, file, 'accepted');
    return;
  }

  const res = await fetch(file.sourceUrl, { headers: { 'user-agent': USER_AGENT } });
  if (!res.ok) throw new Error(`téléchargement ${res.status}`);
  const contentType = res.headers.get('content-type') ?? file.mime;
  const ext = contentType.includes('png')
    ? 'png'
    : contentType.includes('webp')
      ? 'webp'
      : contentType.includes('gif')
        ? 'gif'
        : 'jpg';
  const bytes = new Uint8Array(await res.arrayBuffer());

  const path = `${item.id}/main.${ext}`;
  const upload = await fetch(`${rest.base}/storage/v1/object/item-images/${path}`, {
    method: 'POST',
    headers: {
      apikey: rest.headers.apikey,
      authorization: rest.headers.authorization,
      'content-type': contentType,
      'cache-control': `max-age=${STORAGE_CACHE_CONTROL}`,
      'x-upsert': 'true',
    },
    body: bytes,
  });
  if (!upload.ok) throw new Error(`storage ${upload.status} ${await upload.text()}`);

  const publicUrl = `${rest.base}/storage/v1/object/public/item-images/${path}?v=${Date.now()}`;
  await rest.patch('items', `id=eq.${item.id}`, {
    image_url: publicUrl,
    image_credit: file.attribution,
  });

  await traceSuggestion(rest, item, pageUrl, file, 'accepted');
}

/**
 * Archive la provenance d'une image dans `item_image_suggestions`, pour
 * savoir d'où elle vient sans refaire la recherche. `wikipedia_page_url`
 * porte ici l'URL de la page source quelle que soit la source (Wikipedia ou
 * TMDb) : la colonne est plus vieille que le multi-source.
 */
async function traceSuggestion(rest, item, pageUrl, file, status) {
  await rest.insert(
    'item_image_suggestions',
    [
      {
        item_id: item.id,
        source_url: file.sourceUrl,
        thumbnail_url: file.thumbnailUrl,
        attribution: file.attribution,
        license_code: file.licenseCode,
        wikipedia_page_url: pageUrl,
        status,
      },
    ],
    'return=minimal,resolution=merge-duplicates',
    'item_id,source_url',
  );
}

async function saveSuggestions(rest, item, candidates) {
  // Deux pages Wikipedia différentes peuvent porter la MÊME image (une page
  // et sa redirection, un film et sa franchise). Postgres refuse un upsert
  // qui touche deux fois la même ligne (`ON CONFLICT DO UPDATE command
  // cannot affect row a second time`), donc on dédoublonne par source_url.
  const seen = new Set();
  const unique = candidates.filter((c) => {
    if (seen.has(c.file.sourceUrl)) return false;
    seen.add(c.file.sourceUrl);
    return true;
  });
  await rest.insert(
    'item_image_suggestions',
    unique.map((c) => ({
      item_id: item.id,
      source_url: c.file.sourceUrl,
      thumbnail_url: c.file.thumbnailUrl,
      attribution: c.file.attribution,
      license_code: c.file.licenseCode,
      wikipedia_page_url: c.page.url,
      status: 'pending',
    })),
    'return=minimal,resolution=merge-duplicates',
    'item_id,source_url',
  );
}
