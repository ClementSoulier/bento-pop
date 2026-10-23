/**
 * Le compteur de visites d'un bento, côté web. Chantier 8.
 *
 * Une visite, c'est l'affichage de la page d'un bento publié dans un
 * navigateur. Elle se compte par une image d'un pixel, `/api/bento-opened`,
 * plutôt que par un composant client : la page d'un bento n'expédie aucun
 * JavaScript qui lui soit propre (`e2e/smoke.test.ts`), et une image se
 * charge aussi bien à l'ouverture d'un lien qu'à une navigation interne. Les
 * robots d'aperçu des messageries ne lisent que le HTML : ils ne la
 * demandent pas.
 *
 * L'identité du visiteur ne se garde pas : l'adresse IP et le navigateur
 * forment une empreinte que la base hache avec un sel du jour, puis oublie
 * la nuit suivante (`20261023100000_bento_visits.sql`). Une visite par
 * empreinte, par jour et par bento.
 *
 * Tout ici est pur, sauf `recordWebVisit`, dont le client est injecté pour
 * les tests.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** L'identifiant d'un bento, ou `null` s'il n'en a pas la forme. */
export function parseBentoId(raw: string | null | undefined): string | null {
  return raw && UUID.test(raw) ? raw.toLowerCase() : null;
}

const NUMBER = new Intl.NumberFormat('fr-FR');

/**
 * « 0 visite », « 1 visite », « 1 234 visites ». Zéro et un au singulier, et
 * une espace insécable entre le nombre et le mot : ils ne se séparent jamais
 * en fin de ligne.
 */
export function formatVisits(count: number): string {
  return `${NUMBER.format(count)}\u00a0${count < 2 ? 'visite' : 'visites'}`;
}

/**
 * Les robots connus, et les clients qui n'en sont pas moins des scripts.
 * `robots.txt` ferme déjà `/api/` à ceux qui le lisent ; ce filtre couvre
 * ceux qui ne le lisent pas, et les navigateurs sans tête des outils de
 * mesure. Un navigateur sans identité est un script. `(?<!cu)` épargne les
 * téléphones Cubot, dont le modèle s'écrit `CUBOT X30` dans l'identité.
 */
const BOT =
  /(?<!cu)bot\b|crawl|spider|slurp|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|slack|skype|pinterest|vkshare|headless|lighthouse|pagespeed|google-inspectiontool|validator|python|curl|wget|httpie|okhttp|axios|node-fetch|undici|go-http|java\/|libwww|feedfetcher/i;

export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  return !userAgent?.trim() || BOT.test(userAgent);
}

type HeaderReader = { get(name: string): string | null };

/**
 * Une page préchargée ou prérendue n'a pas encore été vue : le navigateur le
 * dit dans `Sec-Purpose`, ou dans `Purpose` et `X-Moz` chez les plus anciens.
 */
export function isPrefetch(headers: HeaderReader): boolean {
  const purpose = `${headers.get('sec-purpose') ?? ''} ${headers.get('purpose') ?? ''} ${headers.get('x-moz') ?? ''}`;
  return /prefetch|prerender/i.test(purpose);
}

/**
 * L'adresse du visiteur, telle que la pose le proxy de Coolify : la
 * **dernière** valeur de `X-Forwarded-For`, à défaut `X-Real-IP`. Les
 * premières valeurs peuvent venir du visiteur lui-même, qui gonflerait un
 * compteur public en les changeant ; la dernière est celle que le proxy a
 * vue. bento-pop.com pointe sur le VPS sans CDN devant (relevé le 23 octobre
 * 2026) : ce proxy est le seul. `null` sans adresse : tous les visiteurs d'un
 * même navigateur se confondraient en une seule visite, autant ne rien
 * compter.
 */
export function clientAddress(headers: HeaderReader): string | null {
  const forwarded = (headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .at(-1);
  if (forwarded) return forwarded;
  return headers.get('x-real-ip')?.trim() || null;
}

/** La base refuse une empreinte de plus de 1024 caractères. */
const FINGERPRINT_MAX = 1024;

export function visitFingerprint(address: string, userAgent: string): string {
  return `${address}|${userAgent}`.slice(0, FINGERPRINT_MAX);
}

/**
 * Ce qu'est devenue une visite. Renvoyé dans l'en-tête `X-Bento-Visit` de la
 * réponse, pour le diagnostic et les tests : l'image, elle, est toujours la
 * même. `recorded` dit que la base a reçu la visite, pas qu'elle l'a comptée :
 * elle écarte d'elle-même une empreinte déjà vue le même jour.
 */
export type VisitOutcome =
  | 'recorded'
  | 'invalid'
  | 'bot'
  | 'prefetch'
  | 'no-address'
  | 'disabled'
  | 'error';

/** Ce que `recordWebVisit` demande du client Supabase mobile. */
export type VisitClient = {
  rpc(
    fn: 'record_bento_visit_web',
    args: { p_bento: string; p_fingerprint: string; p_secret: string },
  ): PromiseLike<{ error: { message: string; code?: string } | null }>;
};

/**
 * Enregistre une visite web, ou dit pourquoi elle ne compte pas. Ne lève
 * jamais : une visite perdue vaut mieux qu'une erreur.
 *
 * `disabled` : le secret manque, côté landing (`BENTO_VISIT_SECRET`) ou
 * côté base (le coffre répond `55000`) ; le comptage attend sa mise en
 * service. Un secret refusé (`42501`) est une erreur de configuration, et se
 * journalise comme telle.
 */
export async function recordWebVisit({
  bentoId,
  headers,
  secret,
  client,
}: {
  bentoId: string | null;
  headers: HeaderReader;
  secret: string | null | undefined;
  client: VisitClient | null;
}): Promise<VisitOutcome> {
  const id = parseBentoId(bentoId);
  if (!id) return 'invalid';

  const userAgent = headers.get('user-agent');
  if (isBotUserAgent(userAgent)) return 'bot';
  if (isPrefetch(headers)) return 'prefetch';

  const address = clientAddress(headers);
  if (!address) return 'no-address';

  if (!secret || !client) return 'disabled';

  try {
    const { error } = await client.rpc('record_bento_visit_web', {
      p_bento: id,
      p_fingerprint: visitFingerprint(address, userAgent ?? ''),
      p_secret: secret,
    });
    if (!error) return 'recorded';
    if (error.code === '55000') return 'disabled';
    console.error(`[bento/visits] visite refusée (${error.code ?? 'sans code'}) :`, error.message);
    return 'error';
  } catch (error) {
    console.error('[bento/visits] visite perdue :', error instanceof Error ? error.message : error);
    return 'error';
  }
}
