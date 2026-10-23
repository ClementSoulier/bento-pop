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
  published_at: string;
  is_featured: boolean;
  bento_items: { category_id: number; items: StubItem | null }[];
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
    // Profil existant sans bento publié : `bentos_read_published` renvoie
    // `null`, comme pour un bento qui n'existe pas encore.
    pseudo: 'brouillon',
    display_name: 'En cours',
    bentos: null,
  },
];

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
  const visitCalls: VisitCall[] = [];

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);

    if (url.pathname === '/__stats') {
      return json(res, 200, { requests });
    }
    if (url.pathname === '/__visits') {
      return json(res, 200, visitCalls);
    }
    if (url.pathname === '/__reset') {
      requests = 0;
      failing = false;
      visitCalls.length = 0;
      return json(res, 200, { ok: true });
    }
    if (url.pathname === '/__fail') {
      failing = true;
      return json(res, 200, { ok: true });
    }

    requests += 1;

    if (failing) {
      return json(res, 500, { message: 'stub en panne simulée' });
    }

    if (url.pathname === '/rest/v1/users') {
      const filter = url.searchParams.get('pseudo') ?? '';
      const pattern = filter.startsWith('ilike.') ? filter.slice('ilike.'.length) : null;
      const rows = pattern ? USERS.filter((u) => ilikeMatches(pattern, u.pseudo)) : [];
      return json(res, 200, rows);
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
          users: { pseudo: USERS.find((u) => bentosOf(u).includes(b))!.pseudo },
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
