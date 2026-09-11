import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Chargement des polices de l'image Open Graph.
 *
 * Satori n'a aucune police système : tout glyphe absent des tampons fournis
 * est rendu en carré vide. Extenda couvre 809 points de code — latin
 * complet, accents français, ponctuation typographique, `@` — mais pas les
 * symboles décoratifs ni les écritures non latines.
 *
 * Relevé sur les 277 items du catalogue au 11 septembre 2026, huit titres
 * sortent de cette couverture : six en japonais (`稲葉曇`,
 * `ロストアンブレラ`…), un avec `★`, un avec un tiret U+2010. Trois pour
 * cent, mais un aperçu de partage constellé de carrés vides est pire que
 * pas d'aperçu du tout.
 *
 * Stratégie en deux temps :
 *   1. normaliser ce qui a un équivalent couvert (tirets et guillemets
 *      typographiques), sans réseau ni incertitude ;
 *   2. pour ce qui reste, récupérer un sous-ensemble de police contenant
 *      exactement les glyphes manquants. Satori choisit lui-même, glyphe
 *      par glyphe, la première police du tableau qui le possède.
 */

const FONT_PATH = path.join(
  process.cwd(),
  '../../packages/brand/assets/fonts/extenda-100-yotta.otf',
);

/** Chemin de repli quand `cwd` est déjà la racine du dépôt (build standalone). */
const FONT_PATH_FROM_ROOT = path.join(
  process.cwd(),
  'packages/brand/assets/fonts/extenda-100-yotta.otf',
);

let extendaPromise: Promise<Buffer> | null = null;

/** Charge Extenda une fois par processus. */
export function loadExtenda(): Promise<Buffer> {
  extendaPromise ??= readFile(FONT_PATH).catch(() => readFile(FONT_PATH_FROM_ROOT));
  return extendaPromise;
}

export { coveredCodePoints, missingGlyphs, normalizeForOg } from './glyphs';

// ─── Police de repli ───────────────────────────────────────────────────

const FALLBACK_TIMEOUT_MS = 2000;

/**
 * Récupère un sous-ensemble de Noto Sans JP contenant exactement les
 * glyphes manquants.
 *
 * Le paramètre `text=` de l'API Google Fonts renvoie une police
 * sous-ensemblée : une dizaine d'idéogrammes pèsent quelques kilo-octets,
 * là où la police complète en fait plusieurs méga-octets. Elle couvre le
 * japonais, les kana, et par héritage la plupart des symboles courants.
 *
 * L'en-tête `User-Agent` est délibérément ancien : l'API sert du WOFF2 aux
 * navigateurs modernes, or satori ne lit que TTF, OTF et WOFF. Un vieil
 * agent déclenche la variante TrueType.
 *
 * Renvoie `null` en cas d'échec ou de dépassement du délai. L'appelant
 * rend alors l'image sans ce repli : on retombe sur des carrés vides,
 * c'est-à-dire l'état antérieur, jamais une image absente.
 */
export async function fetchFallbackFont(chars: string): Promise<ArrayBuffer | null> {
  if (!chars) return null;

  const signal = AbortSignal.timeout(FALLBACK_TIMEOUT_MS);
  const cssUrl =
    'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700&text=' +
    encodeURIComponent(chars);

  try {
    const cssRes = await fetch(cssUrl, {
      signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/40.0 Safari/537.36',
      },
      // La réponse ne dépend que de `chars` : mise en cache longue côté
      // Next, la génération d'une image ne doit pas rappeler Google.
      next: { revalidate: 60 * 60 * 24 * 30 },
    });
    if (!cssRes.ok) return null;

    const css = await cssRes.text();
    const url = /src:\s*url\((https:\/\/[^)]+)\)/.exec(css)?.[1];
    if (!url) return null;

    const fontRes = await fetch(url, { signal, next: { revalidate: 60 * 60 * 24 * 30 } });
    if (!fontRes.ok) return null;
    return await fontRes.arrayBuffer();
  } catch {
    return null;
  }
}
