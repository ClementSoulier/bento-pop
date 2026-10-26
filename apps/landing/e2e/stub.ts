import { createServer, type Server, type ServerResponse } from 'node:http';

/**
 * Bouchon PostgREST pour les tests d'intégration.
 *
 * On bouchonne au niveau du **protocole**, pas du client : le vrai
 * `@supabase/supabase-js` construit ses requêtes, le vrai serveur Next les
 * déclenche, le vrai rendu s'exécute. Un `mock` du client aurait laissé
 * hors couverture tout ce qui casse en pratique — forme du `select`,
 * comportement du joker `ilike`, normalisation des relations.
 *
 * Aucun branchement de test dans le code de production, et aucun
 * identifiant Supabase requis en CI.
 */

const YEAR = '2026-05-15T15:05:24.848+00:00';

/**
 * Des identifiants de la forme d'un UUID, comme en base : la route des
 * visites refuse tout autre forme sans interroger la base. Chantier 8.
 */
export const bentoId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/**
 * Le compteur de chaque bento, tel que `bento_visit_count` le rend au
 * visiteur : zéro pour `buyt.k`, nul pour `invite`, dont le propriétaire
 * masque ses visites. Trois pour les autres.
 */
const VISITS: Record<string, number | null> = {
  [bentoId(1)]: 47,
  [bentoId(2)]: 0,
  [bentoId(6)]: null,
};
const visitsOf = (id: string | undefined) => (id && id in VISITS ? VISITS[id]! : 3);

/** Un appel de `record_bento_visit_web`, tel que la landing l'envoie. */
export type VisitCall = { p_bento: string; p_fingerprint: string; p_secret: string };

/**
 * Les épisodes de la landing, chantier 19, tels que la base les rendrait…
 * sans appliquer de filtre : un épisode programmé et un épisode sans date en
 * font partie, et c'est à la route de les écarter. Les filtres qu'elle
 * demande à la base sont relevés à part, cf. `/__episodes`.
 */
const SHOW_EPISODES = [
  {
    id: 'show-1',
    slug: 'il-reprend-les-generiques',
    title: 'Il reprend les génériques avec les vraies voix FR',
    youtube_id: 'dQw4w9WgXcQ',
    thumbnail_url: null,
    duration_seconds: 2530,
    published_at: '2026-10-20T16:00:00+00:00',
    season: 2,
    episode_number: 5,
  },
  {
    id: 'show-2',
    slug: 'vivre-de-tiktok-a-20-ans',
    title: 'Vivre de TikTok à 20 ans',
    youtube_id: 'aBcDeF12345',
    thumbnail_url: 'https://cdn.bento-pop.test/miniature.jpg',
    duration_seconds: null,
    published_at: '2026-10-06T16:00:00+00:00',
    season: 2,
    episode_number: 3,
  },
  {
    id: 'show-programmee',
    slug: 'pas-encore-sortie',
    title: 'Pas encore sortie',
    youtube_id: 'zZzZzZzZzZz',
    thumbnail_url: null,
    duration_seconds: 1800,
    published_at: '2099-01-01T16:00:00+00:00',
    season: 3,
    episode_number: 1,
  },
  {
    id: 'show-sans-date',
    slug: 'sans-date',
    title: 'Sans date',
    youtube_id: 'yYyYyYyYyYy',
    thumbnail_url: null,
    duration_seconds: 1200,
    published_at: null,
    season: 1,
    episode_number: null,
  },
];

const PODCAST_EPISODES = [
  {
    id: 'podcast-1',
    slug: 'du-mont-fuji-a-fukushima',
    title: 'Du mont Fuji à Fukushima',
    spotify_episode_id: '4rOoJ6Egrf8K2IrywzwOMk',
    audio_platform: 'spotify',
    audio_show_id: null,
    thumbnail_url: null,
    duration_seconds: 2280,
    published_at: '2026-10-13T16:00:00+00:00',
    season: 2,
    episode_number: 4,
  },
  {
    // Pas encore repris par Spotify, comme 3 podcasts sur 20 au 23 octobre
    // 2026 : il s'ouvre sur sa page du site (D13).
    id: 'podcast-a-remplacer',
    slug: 'ambiance-tokyo-a-la-maison',
    title: 'Ambiance Tokyo à la maison',
    spotify_episode_id: 'A_REMPLACER',
    audio_platform: 'spotify',
    audio_show_id: null,
    thumbnail_url: null,
    duration_seconds: 2000,
    published_at: '2026-10-01T16:00:00+00:00',
    season: 2,
    episode_number: 3,
  },
  {
    id: 'podcast-2',
    slug: 'le-plus-grand-musee-du-jeu-video',
    title: 'Le plus grand musée du jeu vidéo',
    spotify_episode_id: '1000650000001',
    audio_platform: 'apple',
    audio_show_id: '1234567890',
    thumbnail_url: null,
    duration_seconds: 2400,
    published_at: '2026-09-29T16:00:00+00:00',
    season: 2,
    episode_number: 2,
  },
  {
    id: 'podcast-3',
    slug: 'le-petit-chaperon-rouge-en-manga',
    title: 'Le Petit Chaperon rouge en manga',
    spotify_episode_id: '700000001',
    audio_platform: 'deezer',
    audio_show_id: null,
    thumbnail_url: null,
    duration_seconds: 2100,
    published_at: '2026-09-15T16:00:00+00:00',
    season: 2,
    episode_number: 1,
  },
];

/** La sélection légère de `/api/episodes`, que seule la route demande. */
const EPISODE_SELECTS: Record<string, string> = {
  '/rest/v1/landing_show_episodes':
    'id,slug,title,youtube_id,thumbnail_url,duration_seconds,published_at,season,episode_number',
  '/rest/v1/landing_podcast_episodes':
    'id,slug,title,spotify_episode_id,audio_platform,audio_show_id,thumbnail_url,duration_seconds,published_at,season,episode_number',
};

/** Une lecture d'épisodes telle que la base l'a reçue : la table et ses paramètres. */
export type EpisodeQuery = { table: string; params: Record<string, string[]> };

type StubItem = {
  id: string;
  title: string;
  subtitle: string | null;
  year: number | null;
  image_url: string | null;
  image_credit: string | null;
};

type StubUser = {
  pseudo: string;
  display_name: string | null;
  /** `member` par défaut ; `editorial` pour un bento composé par l'équipe. */
  kind?: string;
  /**
   * « Apparaître dans la recherche », chantier 20. Absent, comme avant sa
   * migration : la landing le lit alors allumé.
   */
  searchable?: boolean;
  /** Le Popy choisi, chantier 21. Absent : celui du pseudo. */
  avatar?: string | null;
  /**
   * Objet tant que `bentos_user_id_key` existe, TABLEAU dès qu'elle est
   * levée : PostgREST choisit la forme d'après les contraintes, et le change
   * même pour un compte qui n'a qu'un bento. Les deux formes sont donc
   * représentées ici, parce que la landing doit traverser la migration sans
   * rien changer (chantier 16, §4.3 de la spéc).
   */
  bentos: StubBento | StubBento[] | null;
};

type StubBento = {
  id: string;
  slug: string;
  is_primary: boolean;
  /** Nul pour un bento libre ; le bouchon le pose s'il manque. */
  edition_id?: number | null;
  published_at: string;
  is_featured: boolean;
  bento_items: { category_id: number; items: StubItem | null; bento_whys?: { body: string } | null }[];
};

const item = (id: string, title: string, extra: Partial<StubItem> = {}): StubItem => ({
  id,
  title,
  subtitle: null,
  year: null,
  image_url: null,
  image_credit: null,
  ...extra,
});

/** Six cases complètes, titres distinctifs pour les assertions. */
const fullItems = [
  { category_id: 1, items: item('it-film', 'Interstellar', { year: 2014, subtitle: '2014' }) },
  { category_id: 2, items: item('it-serie', 'Severance') },
  { category_id: 3, items: item('it-artiste', 'Orelsan') },
  { category_id: 4, items: item('it-chanson', 'La Quete') },
  { category_id: 5, items: item('it-crea', 'Squeezie') },
  { category_id: 6, items: item('it-lieu', 'Japan Expo') },
];

/**
 * Jeu de données. La casse stockée de `Keremasan` est volontairement
 * différente de celle qu'on demandera dans l'URL : c'est ce qui permet de
 * vérifier la redirection canonique.
 */
export const USERS: StubUser[] = [
  {
    pseudo: 'Keremasan',
    display_name: 'Clement',
    bentos: {
      id: bentoId(1),
      slug: 'mon-bento',
      is_primary: true,
      published_at: YEAR,
      is_featured: true,
      bento_items: fullItems,
    },
  },
  {
    pseudo: 'buyt.k',
    display_name: null,
    bentos: {
      id: bentoId(2),
      slug: 'mon-bento',
      is_primary: true,
      published_at: YEAR,
      is_featured: false,
      bento_items: fullItems,
    },
  },
  {
    // Un item rejeté après publication : la policy laisse passer la ligne
    // de liaison mais masque l'item. Le visiteur reçoit `items: null`.
    pseudo: 'rejete',
    display_name: null,
    bentos: {
      id: bentoId(3),
      slug: 'mon-bento',
      is_primary: true,
      published_at: YEAR,
      is_featured: false,
      bento_items: [...fullItems.slice(0, 5), { category_id: 6, items: null }],
    },
  },
  {
    // Bento invité : composé par l'équipe pour un créateur rencontré hors de
    // l'app, et **aussi** mis en avant, ce qui est le cas courant. Sert à
    // vérifier que la pastille « Invité » l'emporte sur « À la une » : c'est
    // la seule information que le visiteur ne peut déduire d'aucune autre.
    pseudo: 'invite',
    display_name: 'Créateur Invité',
    kind: 'editorial',
    bentos: { id: bentoId(6), slug: 'mon-bento', is_primary: true, published_at: YEAR, is_featured: true, bento_items: fullItems },
  },
  {
    // Réservé au test de redirection canonique : aucun autre test ne doit
    // demander ce pseudo, sous quelque casse que ce soit. Sur un système
    // de fichiers insensible à la casse (macOS), le cache ISR de Next ne
    // distingue pas `/u/MaJuScUlE` de `/u/majuscule` : deux tests visant
    // le même pseudo à des casses différentes se contamineraient.
    pseudo: 'majuscule',
    display_name: null,
    bentos: { id: bentoId(4), slug: 'mon-bento', is_primary: true, published_at: YEAR, is_featured: false, bento_items: fullItems },
  },
  {
    // Deux bentos publiés, rendus en TABLEAU : c'est la forme que prend la
    // relation une fois `bentos_user_id_key` levée. Sert à vérifier que le
    // principal reste à `/u/deuxbentos` et que le second a sa propre adresse.
    pseudo: 'deuxbentos',
    display_name: null,
    bentos: [
      {
        id: bentoId(7),
        slug: 'hebdo-38',
        is_primary: false,
        published_at: '2026-02-01T10:00:00.000Z',
        is_featured: false,
        bento_items: fullItems,
      },
      {
        id: bentoId(8),
        slug: 'mon-bento',
        is_primary: true,
        published_at: YEAR,
        is_featured: false,
        bento_items: fullItems,
      },
    ],
  },
  {
    // Mis en avant par l'équipe, mais retiré de la recherche par son
    // propriétaire : `noindex`, et absent du sitemap (chantier 20, D7).
    pseudo: 'retire.recherche',
    display_name: null,
    searchable: false,
    bentos: { id: bentoId(9), slug: 'mon-bento', is_primary: true, published_at: YEAR, is_featured: true, bento_items: fullItems },
  },
  {
    // Réservé au test du repli d'avant la migration du chantier 20 : la page
    // doit se rendre quand la base ne connaît pas encore `searchable`. Jamais
    // demandé ailleurs, pour que le cache ISR ne serve pas un rendu antérieur.
    pseudo: 'avant.vingt',
    display_name: null,
    bentos: { id: bentoId(10), slug: 'mon-bento', is_primary: true, published_at: YEAR, is_featured: false, bento_items: fullItems },
  },
  {
    // Chantier 12 : deux cases expliquées, en objet comme PostgREST rend un
    // un-à-un, que la page doit montrer sous la boîte.
    pseudo: 'avec.pourquoi',
    display_name: null,
    bentos: {
      id: bentoId(18),
      slug: 'mon-bento',
      is_primary: true,
      published_at: YEAR,
      is_featured: false,
      bento_items: fullItems.map((row) =>
        row.category_id === 1
          ? { ...row, bento_whys: { body: 'Le premier film vu au cinéma avec mon père.' } }
          : row.category_id === 4
            ? { ...row, bento_whys: { body: 'Le refrain de mes vacances 🎶' } }
            : row,
      ),
    },
  },
  {
    // Réservé au test du repli d'avant la migration du chantier 12 : la base
    // ne connaît pas `bento_whys`, la page doit se rendre comme avant.
    pseudo: 'avant.douze',
    display_name: null,
    bentos: { id: bentoId(19), slug: 'mon-bento', is_primary: true, published_at: YEAR, is_featured: false, bento_items: fullItems },
  },
  {
    // Chantier 21 : un Popy choisi, que la page doit montrer à la place de
    // celui que tire son pseudo.
    pseudo: 'popy.choisi',
    display_name: null,
    avatar: 'diable',
    bentos: { id: bentoId(11), slug: 'mon-bento', is_primary: true, published_at: YEAR, is_featured: false, bento_items: fullItems },
  },
  {
    // Chantier 21 : le compte qui portait `ancien.nom`, sous un pseudo à
    // majuscules, pour que la redirection mène à la forme canonique.
    pseudo: 'Nouveau.Nom',
    display_name: null,
    bentos: [
      { id: bentoId(12), slug: 'mon-bento', is_primary: true, published_at: YEAR, is_featured: false, bento_items: fullItems },
      { id: bentoId(13), slug: 'hebdo-1', is_primary: false, published_at: '2026-06-01T10:00:00.000Z', is_featured: false, bento_items: fullItems },
    ],
  },
  {
    // Chantier 21 : un principal et deux autres, publiés avant et après lui,
    // pour l'ordre de la liste sous la page.
    pseudo: 'troisbentos',
    display_name: null,
    bentos: [
      { id: bentoId(14), slug: 'ancien-hebdo', is_primary: false, published_at: '2026-02-01T10:00:00.000Z', is_featured: false, bento_items: fullItems },
      { id: bentoId(15), slug: 'mon-bento', is_primary: true, published_at: YEAR, is_featured: false, bento_items: fullItems },
      { id: bentoId(16), slug: 'hebdo-recent', is_primary: false, published_at: '2026-09-01T10:00:00.000Z', is_featured: false, bento_items: fullItems },
    ],
  },
  {
    // Réservé au test du repli d'avant la migration du chantier 21, comme
    // `avant.vingt` pour celle du 20. Mis en avant et retiré de la recherche :
    // le repli doit garder `searchable`, que la base connaît déjà, et la page
    // rester en `noindex`.
    pseudo: 'avant.vingtetun',
    display_name: null,
    searchable: false,
    bentos: { id: bentoId(17), slug: 'mon-bento', is_primary: true, published_at: YEAR, is_featured: true, bento_items: fullItems },
  },
  {
    // Profil existant sans bento publié : `bentos_read_published` renvoie
    // `null`, comme pour un bento qui n'existe pas encore.
    pseudo: 'brouillon',
    display_name: 'En cours',
    bentos: null,
  },
];

/**
 * Les anciens pseudos, chantier 21, tels que `resolve_pseudo` les rend : le
 * pseudo d'aujourd'hui du compte qui les a portés. `ancien.avant` sert au
 * repli d'avant la migration, que personne d'autre ne demande.
 */
const MOVED: Record<string, string> = {
  'ancien.nom': 'Nouveau.Nom',
  'ancien.avant': 'Nouveau.Nom',
};

/** Les bentos d'un compte, quelle que soit la forme rendue par PostgREST. */
function bentosOf(user: StubUser): StubBento[] {
  if (!user.bentos) return [];
  return Array.isArray(user.bentos) ? user.bentos : [user.bentos];
}

/** Reproduit la sémantique d'`ILIKE` : `%` quelconque, `_` un caractère. */
function ilikeMatches(pattern: string, value: string): boolean {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^${escaped.replace(/%/g, '.*').replace(/_/g, '.')}$`, 'i');
  return regex.test(value);
}

export function startStub(port: number): Promise<Server> {
  let requests = 0;
  let failing = false;
  let before20 = false;
  let before21 = false;
  let before12 = false;
  const visitCalls: VisitCall[] = [];
  const episodeQueries: EpisodeQuery[] = [];

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);

    if (url.pathname === '/__stats') {
      return json(res, 200, { requests });
    }
    if (url.pathname === '/__visits') {
      return json(res, 200, visitCalls);
    }
    if (url.pathname === '/__episodes') {
      return json(res, 200, episodeQueries);
    }
    if (url.pathname === '/__reset') {
      requests = 0;
      failing = false;
      before20 = false;
      before21 = false;
      before12 = false;
      visitCalls.length = 0;
      episodeQueries.length = 0;
      return json(res, 200, { ok: true });
    }
    if (url.pathname === '/__fail') {
      failing = true;
      return json(res, 200, { ok: true });
    }
    if (url.pathname === '/__avant-20') {
      before20 = true;
      return json(res, 200, { ok: true });
    }
    if (url.pathname === '/__avant-21') {
      before21 = true;
      return json(res, 200, { ok: true });
    }
    if (url.pathname === '/__avant-12') {
      before12 = true;
      return json(res, 200, { ok: true });
    }

    // Le Supabase de la landing, branché sur le même bouchon depuis le
    // chantier 19. Ses lectures ne comptent pas dans `requests`, qui dit si
    // la base mobile a été interrogée. Seule la sélection de `/api/episodes`
    // a des données : les pages du catalogue, du site et des épisodes, qui
    // demandent d'autres colonnes, restent sur leur repli comme avant.
    if (url.pathname.startsWith('/rest/v1/landing_')) {
      if (failing) return json(res, 500, { message: 'stub en panne simulée' });
      const expected = EPISODE_SELECTS[url.pathname];
      if (!expected || url.searchParams.get('select') !== expected) {
        return json(res, 404, { message: 'route non bouchonnée', path: url.pathname });
      }
      const params: Record<string, string[]> = {};
      for (const [key, value] of url.searchParams) (params[key] ??= []).push(value);
      episodeQueries.push({ table: url.pathname.slice('/rest/v1/'.length), params });
      return json(
        res,
        200,
        url.pathname === '/rest/v1/landing_show_episodes' ? SHOW_EPISODES : PODCAST_EPISODES,
      );
    }

    requests += 1;

    if (failing) {
      return json(res, 500, { message: 'stub en panne simulée' });
    }

    // Avant la migration du chantier 12, PostgREST ne connaît pas la relation.
    if (before12 && /\bbento_whys\b/.test(url.searchParams.get('select') ?? '')) {
      return json(res, 400, {
        code: 'PGRST200',
        message: "Could not find a relationship between 'bento_items' and 'bento_whys' in the schema cache",
      });
    }
    // Avant la migration du chantier 20, PostgREST refuse la colonne inconnue.
    if (before20 && (url.searchParams.get('select') ?? '').includes('searchable')) {
      return json(res, 400, { code: '42703', message: 'column users.searchable does not exist' });
    }
    // Avant celle du chantier 21, de même, et sa fonction n'existe pas.
    if (before21 && /\bavatar\b/.test(url.searchParams.get('select') ?? '')) {
      return json(res, 400, { code: '42703', message: 'column users.avatar does not exist' });
    }
    if (before21 && url.pathname === '/rest/v1/rpc/resolve_pseudo') {
      return json(res, 404, { code: 'PGRST202', message: 'Could not find the function public.resolve_pseudo' });
    }

    if (url.pathname === '/rest/v1/users') {
      const filter = url.searchParams.get('pseudo') ?? '';
      const pattern = filter.startsWith('ilike.') ? filter.slice('ilike.'.length) : null;
      const rows = pattern ? USERS.filter((u) => ilikeMatches(pattern, u.pseudo)) : [];
      // Les colonnes des migrations ne reviennent que demandées, comme chez
      // PostgREST : sans ça, un repli qui perd `searchable` passerait inaperçu.
      const select = url.searchParams.get('select') ?? '';
      const projected = rows.map((row) => {
        const copy: Partial<StubUser> = { ...row };
        if (!/\bsearchable\b/.test(select)) delete copy.searchable;
        if (!/\bavatar\b/.test(select)) delete copy.avatar;
        // `edition_id` revient toujours, nul pour un bento libre, comme chez
        // PostgREST : absent, la landing lisait chaque bento du bouchon comme
        // une édition sans cases, et dessinait une boîte vide depuis le
        // chantier 13, relevé au 12. Les pourquoi, eux, ne reviennent que
        // demandés.
        const withWhys = /\bbento_whys\b/.test(select);
        const shape = (b: StubBento): StubBento => ({
          ...b,
          edition_id: b.edition_id ?? null,
          bento_items: withWhys ? b.bento_items : b.bento_items.map(({ bento_whys: _, ...rest }) => rest),
        });
        if (copy.bentos) {
          copy.bentos = Array.isArray(copy.bentos) ? copy.bentos.map(shape) : shape(copy.bentos);
        }
        return copy;
      });
      return json(res, 200, projected);
    }

    if (url.pathname === '/rest/v1/bentos') {
      // Une ligne par BENTO, comme PostgREST, et non par personne : c'est ce
      // qui rendait la duplication de pseudos dans le sitemap structurellement
      // intestable avant le chantier 16.
      const featured = USERS.flatMap((u) => bentosOf(u))
        .filter((b) => b.is_featured && b.published_at)
        .map((b, i) => ({
          featured_order: i,
          slug: b.slug,
          is_primary: b.is_primary,
          users: (({ pseudo, searchable }) => ({ pseudo, searchable }))(
            USERS.find((u) => bentosOf(u).includes(b))!,
          ),
        }));
      return json(res, 200, featured);
    }

    // Les fonctions du chantier 8, appelées en POST avec leurs arguments en
    // JSON. Une fonction scalaire répond par sa valeur seule, `null` compris.
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      let raw = '';
      req.on('data', (chunk) => (raw += chunk));
      req.on('end', () => {
        const args = (raw ? JSON.parse(raw) : {}) as Partial<VisitCall>;
        const fn = url.pathname.slice('/rest/v1/rpc/'.length);
        if (fn === 'bento_visit_count') return json(res, 200, visitsOf(args.p_bento));
        if (fn === 'resolve_pseudo') {
          const asked = String((args as { p_pseudo?: string }).p_pseudo ?? '').toLowerCase();
          return json(res, 200, MOVED[asked] ?? null);
        }
        if (fn === 'record_bento_visit_web') {
          visitCalls.push(args as VisitCall);
          return json(res, 200, visitsOf(args.p_bento));
        }
        return json(res, 404, { message: 'fonction non bouchonnée', path: url.pathname });
      });
      return;
    }

    return json(res, 404, { message: 'route non bouchonnée', path: url.pathname });
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}
