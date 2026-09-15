/**
 * Recherche d'illustrations sur Wikipedia / Wikimedia Commons.
 *
 * Vit côté BO plutôt que dans une Edge Function : la recherche n'a besoin
 * d'aucun secret ni d'aucun accès base, elle est appelée uniquement par
 * l'admin depuis `/catalogue`, et la garder ici évite un artefact à
 * déployer séparément sur Supabase.
 *
 * Deux règles portent toute la valeur de ce module :
 *
 * 1. **Filtre de licence** : on ne retient que les fichiers hébergés sur
 *    Wikimedia Commons. Commons n'accepte que du réutilisable ; à
 *    l'inverse en.wikipedia héberge en local des affiches de films et des
 *    pochettes d'albums sous fair use, qu'on n'a pas le droit de republier
 *    dans l'app. Un fichier absent de Commons est écarté, quitte à rendre
 *    moins de candidats.
 * 2. **Typage par description Wikidata** (« film de Christopher Nolan »,
 *    « commune de France ») : affiché à l'admin pour distinguer deux
 *    homonymes sans ouvrir l'article.
 *
 * Le script batch `scripts/catalog-images.mjs` applique les mêmes règles
 * pour le traitement en masse. Les deux implémentations sont volontairement
 * séparées (l'une TypeScript côté Next, l'autre Node pur sans build) ; si
 * l'une évolue, penser à l'autre.
 */

const USER_AGENT = 'BentoPopAdmin/1.0 (https://bento-pop.com; contact@keremaprod.com)';
const THUMB_WIDTH = 1200;
const TOP_N = 3;

/**
 * Indice ajouté à la requête pour désambiguïser (« Seven film »). Clés de case
 * pour les items qui en ont une, clés de type pour les autres, depuis le
 * chantier 15 : un livre créé dans le back-office n'a pas de case.
 */
const CATEGORY_HINTS: Record<string, string> = {
  film: 'film',
  series: 'série télévisée',
  artist: 'musique',
  track: 'chanson',
  creator: 'vidéaste web',
  place: '',
  person: '',
  song: 'chanson',
  video_game: 'jeu vidéo',
  book: 'livre',
  dish: 'plat',
  activity: '',
};

export type WikimediaCandidate = {
  sourceUrl: string;
  thumbnailUrl: string;
  wikipediaPageUrl: string;
  pageTitle: string;
  description: string | null;
  attribution: string | null;
  licenseCode: string | null;
};

type WikiPage = {
  title: string;
  fullurl?: string;
  pageimage?: string;
  thumbnail?: { source: string };
  pageprops?: { wikibase_item?: string };
};

/**
 * Cherche jusqu'à 3 illustrations réutilisables pour un titre donné.
 *
 * Ordre des tentatives : FR avec indice de catégorie, FR seul, puis EN de
 * même. Notre public est francophone, mais beaucoup de créateurs et de
 * lieux n'ont qu'une page EN. On s'arrête dès qu'on a assez de candidats.
 */
export async function findWikimediaImages(
  title: string,
  categoryKey: string | null,
): Promise<WikimediaCandidate[]> {
  const hint = categoryKey ? (CATEGORY_HINTS[categoryKey] ?? '') : '';
  const attempts: Array<{ lang: 'fr' | 'en'; query: string }> = [];
  for (const lang of ['fr', 'en'] as const) {
    if (hint) attempts.push({ lang, query: `${title} ${hint}` });
    attempts.push({ lang, query: title });
  }

  const candidates: WikimediaCandidate[] = [];
  const seenPages = new Set<string>();
  const seenFiles = new Set<string>();

  for (const { lang, query } of attempts) {
    if (candidates.length >= TOP_N) break;

    const pages = (await searchPages(lang, query)).filter(
      (p) => p.thumbnail?.source && p.pageimage && !seenPages.has(`${lang}:${p.title}`),
    );
    pages.forEach((p) => seenPages.add(`${lang}:${p.title}`));
    if (pages.length === 0) continue;

    const descriptions = await fetchDescriptions(
      [...new Set(pages.map((p) => p.pageprops?.wikibase_item).filter(Boolean))] as string[],
    );

    for (const page of pages) {
      if (candidates.length >= TOP_N) break;
      // Deux pages peuvent porter la même image (une page et sa
      // redirection, un film et sa franchise) : inutile de la proposer
      // deux fois à l'admin.
      if (!page.pageimage || seenFiles.has(page.pageimage)) continue;
      seenFiles.add(page.pageimage);

      const file = await fetchCommonsFile(page.pageimage);
      if (!file) continue;

      const qid = page.pageprops?.wikibase_item;
      candidates.push({
        sourceUrl: file.sourceUrl,
        thumbnailUrl: page.thumbnail?.source ?? file.sourceUrl,
        wikipediaPageUrl:
          page.fullurl ?? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
        pageTitle: page.title,
        description: (qid ? descriptions.get(qid) : null) ?? null,
        attribution: file.attribution,
        licenseCode: file.licenseCode,
      });
    }
  }

  return candidates;
}

async function wikiJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Résultats de recherche enrichis (vignette + QID) en 2 appels. */
async function searchPages(lang: 'fr' | 'en', query: string): Promise<WikiPage[]> {
  const api = `https://${lang}.wikipedia.org/w/api.php`;

  const search = await wikiJson<{ query?: { search?: Array<{ title: string }> } }>(
    `${api}?${new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: query,
      srlimit: '8',
      format: 'json',
      origin: '*',
    })}`,
  );
  const titles = (search?.query?.search ?? []).map((s) => s.title);
  if (titles.length === 0) return [];

  const pages = await wikiJson<{ query?: { pages?: Record<string, WikiPage> } }>(
    `${api}?${new URLSearchParams({
      action: 'query',
      titles: titles.join('|'),
      prop: 'pageimages|pageprops|info',
      pithumbsize: '480',
      inprop: 'url',
      format: 'json',
      origin: '*',
    })}`,
  );
  const byTitle = new Map(
    Object.values(pages?.query?.pages ?? {}).map((p) => [p.title, p] as const),
  );

  // L'API renvoie les pages dans un ordre arbitraire : on respecte celui
  // de la recherche, qui est l'ordre de pertinence.
  return titles.map((t) => byTitle.get(t)).filter((p): p is WikiPage => Boolean(p));
}

/**
 * Descriptions Wikidata (FR, EN en repli) pour un lot de QID, en un appel.
 * Best-effort : sans description, le candidat s'affiche quand même.
 */
async function fetchDescriptions(qids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (qids.length === 0) return out;

  const data = await wikiJson<{
    entities?: Record<
      string,
      { descriptions?: { fr?: { value?: string }; en?: { value?: string } } }
    >;
  }>(
    `https://www.wikidata.org/w/api.php?${new URLSearchParams({
      action: 'wbgetentities',
      ids: qids.join('|'),
      props: 'descriptions',
      languages: 'fr|en',
      format: 'json',
      origin: '*',
    })}`,
  );

  for (const [qid, entity] of Object.entries(data?.entities ?? {})) {
    const value = entity.descriptions?.fr?.value ?? entity.descriptions?.en?.value;
    if (value) out.set(qid, value);
  }
  return out;
}

/**
 * Métadonnées du fichier SUR COMMONS (auteur, licence, rendu 1200px).
 *
 * On interroge commons.wikimedia.org et pas le wiki de la page : si le
 * fichier n'y existe pas, c'est un fichier local, donc du fair use.
 * Renvoyer `null` dans ce cas est le filtre de licence de ce module.
 *
 * `iiurlwidth` demande à Commons le rendu à la bonne largeur, y compris
 * pour les SVG (rendus en PNG) : plus fiable que de bricoler l'URL de la
 * vignette.
 */
async function fetchCommonsFile(fileName: string): Promise<{
  sourceUrl: string;
  attribution: string | null;
  licenseCode: string | null;
} | null> {
  const data = await wikiJson<{
    query?: {
      pages?: Record<
        string,
        {
          missing?: string;
          imageinfo?: Array<{
            url?: string;
            thumburl?: string;
            extmetadata?: {
              Artist?: { value?: string };
              LicenseShortName?: { value?: string };
              License?: { value?: string };
            };
          }>;
        }
      >;
    };
  }>(
    `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({
      action: 'query',
      titles: `File:${fileName}`,
      prop: 'imageinfo',
      iiprop: 'extmetadata|url',
      iiurlwidth: String(THUMB_WIDTH),
      format: 'json',
      origin: '*',
    })}`,
  );

  const page = Object.values(data?.query?.pages ?? {})[0];
  if (!page || page.missing !== undefined) return null;
  const info = page.imageinfo?.[0];
  const sourceUrl = info?.thumburl ?? info?.url;
  if (!info || !sourceUrl) return null;

  const meta = info.extmetadata ?? {};
  const license = (meta.LicenseShortName?.value ?? meta.License?.value ?? '').trim();
  const licenseCode = (meta.License?.value ?? '').trim().toLowerCase();
  // Commons est censé être 100 % libre : ceinture et bretelles quand même.
  if (/fair use|non-free|nonfree/i.test(`${license} ${licenseCode}`)) return null;

  const author = stripHtml(meta.Artist?.value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  const attribution = author
    ? `Photo : ${author}${license ? ` (${license})` : ''}, via Wikimedia Commons`
    : license
      ? `Wikimedia Commons (${license})`
      : 'Wikimedia Commons';

  return { sourceUrl, attribution, licenseCode: licenseCode || null };
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ');
}
