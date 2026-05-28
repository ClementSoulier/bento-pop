// Edge Function : suggest-item-image
//
// Reçoit `{ itemId }` (POST JSON), va chercher 3 candidats d'illustration
// sur Wikipedia (FR puis fallback EN) pour le titre de l'item, retourne
// la liste avec thumbnail + URL source + attribution + license code.
//
// Cette fonction ÉCRIT RIEN en BDD : c'est le caller (l'admin via server
// action) qui décide quel candidat retenir et déclenche l'upload Storage.
//
// Déploiement : depuis `apps/mobile/`,
//   supabase functions deploy suggest-item-image
// Invocation depuis le BO admin :
//   await mobile.functions.invoke('suggest-item-image', { body: { itemId } })

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const WIKI_LANGUAGES: Array<'fr' | 'en'> = ['fr', 'en'];
const TOP_N = 3;

type WikiCandidate = {
  sourceUrl: string;
  thumbnailUrl: string;
  wikipediaPageUrl: string;
  pageTitle: string;
  attribution: string | null;
  licenseCode: string | null;
};

type EdgeResponse =
  | { ok: true; candidates: WikiCandidate[] }
  | { ok: false; error: string };

function json(body: EdgeResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      // Lock CORS au domaine BO uniquement en prod ; pour l'instant *
      // car le BO peut tourner sur localhost ou Coolify.
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, content-type, x-client-info, apikey',
      'access-control-allow-methods': 'POST, OPTIONS',
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return json({ ok: false, error: 'preflight' });
  }
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'POST only' }, 405);
  }

  let payload: { itemId?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: 'invalid json body' }, 400);
  }
  const itemId = payload.itemId;
  if (!itemId || typeof itemId !== 'string') {
    return json({ ok: false, error: 'itemId requis' }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: item, error } = await supabase
    .from('items')
    .select('title')
    .eq('id', itemId)
    .maybeSingle();
  if (error || !item) {
    return json({ ok: false, error: 'item introuvable' }, 404);
  }

  // FR d'abord (notre public est francophone), EN en fallback si rien trouvé.
  let candidates: WikiCandidate[] = [];
  for (const lang of WIKI_LANGUAGES) {
    candidates = await searchWikipedia(lang, item.title, TOP_N);
    if (candidates.length > 0) break;
  }

  return json({ ok: true, candidates });
});

async function searchWikipedia(
  lang: 'fr' | 'en',
  query: string,
  topN: number,
): Promise<WikiCandidate[]> {
  const api = `https://${lang}.wikipedia.org/w/api.php`;
  // 1. Search pour trouver les articles pertinents
  const searchParams = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: query,
    srlimit: '10', // on prend un peu plus que topN car certains n'auront pas d'image
    format: 'json',
    origin: '*',
  });
  let searchData: { query?: { search?: Array<{ title: string }> } };
  try {
    const res = await fetch(`${api}?${searchParams}`);
    searchData = await res.json();
  } catch {
    return [];
  }
  const titles = (searchData.query?.search ?? []).map((s) => s.title);
  if (titles.length === 0) return [];

  // 2. Pour chaque title, récupère pageimage + URL article en une seule requête batch
  const pageParams = new URLSearchParams({
    action: 'query',
    titles: titles.join('|'),
    prop: 'pageimages|info',
    pithumbsize: '480',
    inprop: 'url',
    format: 'json',
    origin: '*',
  });
  let pageData: {
    query?: {
      pages?: Record<
        string,
        {
          title: string;
          fullurl?: string;
          pageimage?: string;
          thumbnail?: { source: string };
        }
      >;
    };
  };
  try {
    const res = await fetch(`${api}?${pageParams}`);
    pageData = await res.json();
  } catch {
    return [];
  }

  // 3. Filtre les pages qui ont une thumbnail + récupère métadonnées image
  const pages = Object.values(pageData.query?.pages ?? {});
  // Pages retournées dans un ordre arbitraire ; on respecte l'ordre des résultats search
  const pagesByTitle = new Map(pages.map((p) => [p.title, p]));

  const candidates: WikiCandidate[] = [];
  for (const title of titles) {
    if (candidates.length >= topN) break;
    const page = pagesByTitle.get(title);
    if (!page?.thumbnail?.source || !page.pageimage) continue;

    const metadata = await fetchImageMetadata(lang, page.pageimage);
    candidates.push({
      // Upscale le thumbnail à 1200px pour avoir une bonne qualité au final
      // sans payer le coût bandwidth d'une full-res.
      sourceUrl: page.thumbnail.source.replace(/\/480px-/, '/1200px-'),
      thumbnailUrl: page.thumbnail.source,
      wikipediaPageUrl: page.fullurl ?? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`,
      pageTitle: title,
      attribution: metadata.attribution,
      licenseCode: metadata.licenseCode,
    });
  }

  return candidates;
}

/**
 * Fetch les métadonnées (auteur, license) d'une image Wikipedia depuis
 * Commons. Best-effort : si la requête échoue, on retourne null/null —
 * l'admin pourra toujours utiliser l'image en remplissant l'attribution
 * à la main si besoin.
 */
async function fetchImageMetadata(
  lang: 'fr' | 'en',
  pageImage: string,
): Promise<{ attribution: string | null; licenseCode: string | null }> {
  // Note : on tape l'API du même domaine que la page (FR ou EN) plutôt
  // que Commons directement, car certains fichiers sont locaux à FR
  // Wikipedia et n'existent pas sur Commons.
  const api = `https://${lang}.wikipedia.org/w/api.php`;
  const params = new URLSearchParams({
    action: 'query',
    titles: `File:${pageImage}`,
    prop: 'imageinfo',
    iiprop: 'extmetadata',
    format: 'json',
    origin: '*',
  });
  try {
    const res = await fetch(`${api}?${params}`);
    const data: {
      query?: {
        pages?: Record<
          string,
          {
            imageinfo?: Array<{
              extmetadata?: {
                Artist?: { value?: string };
                LicenseShortName?: { value?: string };
                License?: { value?: string };
              };
            }>;
          }
        >;
      };
    } = await res.json();
    const page = Object.values(data.query?.pages ?? {})[0];
    const meta = page?.imageinfo?.[0]?.extmetadata;
    if (!meta) return { attribution: null, licenseCode: null };

    const author = stripHtml(meta.Artist?.value ?? '').trim();
    const license = (meta.LicenseShortName?.value ?? meta.License?.value ?? '').trim();
    const attribution = author && license
      ? `Photo : ${author} (${license}) — Wikimedia`
      : author
        ? `Photo : ${author} — Wikimedia`
        : license
          ? `Wikimedia (${license})`
          : null;
    return {
      attribution,
      licenseCode: license ? slugify(license) : null,
    };
  } catch {
    return { attribution: null, licenseCode: null };
  }
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '');
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
