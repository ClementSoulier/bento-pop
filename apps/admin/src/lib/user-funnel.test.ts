import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  attachTelemetry,
  buildOrphanRows,
  buildUserRows,
  computeFunnel,
  filterUsers,
  funnelShare,
  type AuthAccount,
  type BentoRow,
  type ProfileRow,
} from './user-funnel';

const account = (id: string, createdAt = '2026-01-01T00:00:00Z'): AuthAccount => ({
  id,
  createdAt,
});

const profile = (id: string, over: Partial<ProfileRow> = {}): ProfileRow => ({
  id,
  pseudo: `p${id}`,
  display_name: null,
  kind: 'member',
  created_at: '2026-01-01T00:00:00Z',
  last_seen_at: null,
  platform: null,
  app_version: null,
  ...over,
});

let compteur = 0;
const bento = (userId: string, over: Partial<BentoRow> = {}): BentoRow => ({
  id: `b-${(compteur += 1)}`,
  user_id: userId,
  slug: 'mon-bento',
  is_primary: true,
  published_at: null,
  is_featured: false,
  slots: 0,
  ...over,
});

/** Un bento secondaire du même compte : slug distinct, non principal. */
const secondaire = (userId: string, over: Partial<BentoRow> = {}): BentoRow =>
  bento(userId, { slug: `hebdo-${compteur}`, is_primary: false, ...over });

describe('computeFunnel', () => {
  /**
   * Les chiffres réels du 12 septembre 2026, qui ont motivé cet écran :
   * 106 installations, 70 profils, 56 bentos, 26 publiés. Ce test fige la
   * forme du calcul sur un jeu réduit mais de même nature.
   */
  it('sépare installations, membres, bentos commencés et publiés', () => {
    const accounts = [account('a'), account('b'), account('c'), account('d')];
    const profiles = [profile('a'), profile('b'), profile('c')];
    const bentos = [bento('a', { published_at: '2026-02-01T00:00:00Z' }), bento('b')];

    assert.deepEqual(computeFunnel(accounts, profiles, bentos), {
      installs: 4,
      members: 3,
      started: 2,
      published: 1,
      editorial: 0,
      orphans: 1,
    });
  });

  /**
   * Le point qui compte : un profil éditorial n'a pas installé l'app et son
   * bento a été composé par l'équipe. Le compter fausserait le seul chiffre
   * qui sert à juger l'adoption.
   */
  it('exclut les profils éditoriaux de tous les compteurs d\'usage', () => {
    const accounts = [account('a')];
    const profiles = [profile('a'), profile('edito', { kind: 'editorial' })];
    const bentos = [
      bento('a', { published_at: '2026-02-01T00:00:00Z' }),
      bento('edito', { published_at: '2026-02-02T00:00:00Z', is_featured: true }),
    ];

    const f = computeFunnel(accounts, profiles, bentos);
    assert.equal(f.installs, 1, 'un profil éditorial ne crée pas d\'installation');
    assert.equal(f.members, 1);
    assert.equal(f.started, 1, 'le bento éditorial ne compte pas comme commencé');
    assert.equal(f.published, 1, 'ni comme publié');
    assert.equal(f.editorial, 1, 'il a son propre compteur');
    assert.equal(f.orphans, 0, 'et ne compte pas comme installation sans pseudo');
  });

  it('compte les installations sans profil', () => {
    const accounts = [account('a'), account('b'), account('c')];
    assert.equal(computeFunnel(accounts, [profile('a')], []).orphans, 2);
  });

  it('ne jette pas sur une base vide', () => {
    assert.deepEqual(computeFunnel([], [], []), {
      installs: 0,
      members: 0,
      started: 0,
      published: 0,
      editorial: 0,
      orphans: 0,
    });
  });

  /**
   * Un profil sans compte d'authentification qui n'est pas éditorial est un
   * état anormal, produit par une suppression faite hors du back-office.
   * Le calcul ne doit pas le nier : il reste un membre, et il apparaîtra
   * dans la liste sans compte, ce qui est exactement le signal recherché.
   */
  it('compte un membre orphelin de compte comme membre', () => {
    const f = computeFunnel([], [profile('perdu')], []);
    assert.equal(f.members, 1);
    assert.equal(f.installs, 0);
  });
});

describe('funnelShare', () => {
  it('rend un pourcentage arrondi', () => {
    assert.equal(funnelShare(70, 106), 66);
    assert.equal(funnelShare(26, 106), 25);
  });

  it('rend 0 plutôt que NaN quand il n\'y a aucune installation', () => {
    assert.equal(funnelShare(0, 0), 0);
    assert.equal(funnelShare(5, 0), 0);
    assert.equal(funnelShare(5, -1), 0);
  });
});

describe('buildUserRows', () => {
  it('rattache le bento à son auteur', () => {
    const rows = buildUserRows(
      [profile('a'), profile('b')],
      [bento('a', { slots: 6, published_at: '2026-03-01T00:00:00Z', is_featured: true })],
      new Set(['a', 'b']),
    );
    const a = rows.find((r) => r.id === 'a');
    assert.equal(a?.slots, 6);
    assert.equal(a?.isFeatured, true);
    const b = rows.find((r) => r.id === 'b');
    assert.equal(b?.slots, 0, 'sans bento, zéro case et non undefined');
    assert.equal(b?.publishedAt, null);
  });

  it('signale un profil sans compte d\'authentification', () => {
    const rows = buildUserRows([profile('a'), profile('e', { kind: 'editorial' })], [], new Set(['a']));
    assert.equal(rows.find((r) => r.id === 'a')?.hasAuthAccount, true);
    assert.equal(rows.find((r) => r.id === 'e')?.hasAuthAccount, false);
  });

  /**
   * Tant que l'app instrumentée n'est pas déployée, `last_seen_at` est nul
   * pour tout le monde. Sans le repli sur la date d'inscription, la liste
   * sortirait dans un ordre arbitraire, ce qui donnerait l'impression d'un
   * bug alors que ce sont les données qui manquent.
   */
  it('trie sur la dernière visite, en repli sur l\'inscription', () => {
    const rows = buildUserRows(
      [
        profile('vieux', { created_at: '2026-01-01T00:00:00Z' }),
        profile('recent', { created_at: '2026-06-01T00:00:00Z' }),
        profile('vu', { created_at: '2026-01-02T00:00:00Z', last_seen_at: '2026-09-01T00:00:00Z' }),
      ],
      [],
      new Set(),
    );
    assert.deepEqual(
      rows.map((r) => r.id),
      ['vu', 'recent', 'vieux'],
    );
  });
});

describe('attachTelemetry', () => {
  const seen = { last_seen_at: '2026-09-15T10:00:00Z', platform: 'ios', app_version: '1.2.0' } as const;

  it('prend la télémétrie de la table privée', () => {
    const [row] = attachTelemetry([profile('a')], [{ user_id: 'a', ...seen }]);
    assert.equal(row?.last_seen_at, seen.last_seen_at);
    assert.equal(row?.platform, 'ios');
    assert.equal(row?.app_version, '1.2.0');
  });

  /**
   * Avant la migration, la table privée n'existe pas et `loadTelemetry` rend
   * une liste vide : les colonnes de `users` doivent rester affichées, sinon
   * déployer le back-office en premier effacerait la dernière visite de tous.
   */
  it('garde les colonnes du profil quand la table privée n\'a rien', () => {
    const [row] = attachTelemetry([profile('a', { ...seen, platform: 'android' })], []);
    assert.equal(row?.platform, 'android');
    assert.equal(row?.last_seen_at, seen.last_seen_at);
  });

  it('l\'emporte sur les colonnes vidées par le trigger', () => {
    const rows = attachTelemetry([profile('a'), profile('b')], [{ user_id: 'b', ...seen }]);
    assert.equal(rows.find((r) => r.id === 'a')?.platform, null);
    assert.equal(rows.find((r) => r.id === 'b')?.platform, 'ios');
  });
});

describe('buildOrphanRows', () => {
  it('ne garde que les comptes sans profil, du plus récent au plus ancien', () => {
    const rows = buildOrphanRows(
      [
        account('connu', '2026-01-01T00:00:00Z'),
        account('vieux', '2026-02-01T00:00:00Z'),
        account('neuf', '2026-08-01T00:00:00Z'),
      ],
      [profile('connu')],
    );
    assert.deepEqual(
      rows.map((r) => r.id),
      ['neuf', 'vieux'],
    );
  });
});

describe('filterUsers', () => {
  const rows = buildUserRows(
    [
      profile('1', { pseudo: 'Eleonore', display_name: 'Éléonore Dupont' }),
      profile('2', { pseudo: 'dark_hifus', display_name: null }),
      profile('3', { pseudo: 'keremasan', display_name: 'Clément' }),
    ],
    [],
    new Set(),
  );

  it('rend tout sur une recherche vide', () => {
    assert.equal(filterUsers(rows, '').length, 3);
    assert.equal(filterUsers(rows, '   ').length, 3);
  });

  it('cherche dans le pseudo et le nom affiché', () => {
    assert.equal(filterUsers(rows, 'dark').length, 1);
    assert.equal(filterUsers(rows, 'Dupont').length, 1);
  });

  it('ignore la casse', () => {
    assert.equal(filterUsers(rows, 'KEREMASAN').length, 1);
  });

  /**
   * Chercher « clement » doit trouver « Clément ». Sans repli des accents,
   * la recherche rate exactement les noms français, c'est-à-dire la
   * majorité.
   */
  it('ignore les accents, des deux côtés', () => {
    assert.equal(filterUsers(rows, 'clement').length, 1, 'sans accent → avec accent');
    assert.equal(filterUsers(rows, 'éléonore').length, 1, 'avec accent → sans accent');
  });

  it('ne jette pas sur un nom affiché absent', () => {
    assert.equal(filterUsers(rows, 'zzz').length, 0);
  });
});

/**
 * Chantier 16. L'entonnoir compte des personnes, pas des bentos, et la liste
 * des comptes n'en perd plus en route. Les deux défauts étaient invisibles
 * tant qu'un compte n'avait qu'un bento.
 */
describe('plusieurs bentos par compte', () => {
  it('compte des personnes, donc l’entonnoir reste monotone', () => {
    const accounts = [account('a'), account('b')];
    const profiles = [profile('a'), profile('b')];
    // `a` a trois bentos, dont deux publiés. C'est UNE personne qui a
    // commencé, et UNE qui a publié.
    const bentos = [
      bento('a', { published_at: '2026-02-01T00:00:00Z' }),
      secondaire('a', { published_at: '2026-03-01T00:00:00Z' }),
      secondaire('a'),
      bento('b'),
    ];

    const f = computeFunnel(accounts, profiles, bentos);
    assert.equal(f.started, 2, 'deux personnes ont commencé, pas quatre bentos');
    assert.equal(f.published, 1, 'une seule a publié');
    assert.ok(f.started <= f.members, 'l’entonnoir ne peut pas remonter');
    assert.ok(f.published <= f.started, 'l’entonnoir ne peut pas remonter');
  });

  it('ne dépasse jamais 100 % quand une personne a plusieurs bentos', () => {
    const accounts = [account('a')];
    const profiles = [profile('a')];
    const bentos = [bento('a'), secondaire('a'), secondaire('a')];
    const f = computeFunnel(accounts, profiles, bentos);
    assert.ok(funnelShare(f.started, f.installs) <= 100);
  });

  it('montre le bento principal dans la liste, pas le dernier chargé', () => {
    // L'ordre est volontairement défavorable : le secondaire arrive en tête,
    // comme PostgREST pourrait le rendre sans `order by`.
    const rows = buildUserRows(
      [profile('a')],
      [
        secondaire('a', { slots: 2 }),
        bento('a', { slots: 6, published_at: '2026-03-01T00:00:00Z', is_featured: true }),
      ],
      new Set(['a']),
    );
    const a = rows.find((r) => r.id === 'a');
    assert.equal(a?.slots, 6, 'la cellule montre le principal');
    assert.equal(a?.isFeatured, true);
    assert.equal(a?.publishedAt, '2026-03-01T00:00:00Z');
  });

  it('ne perd plus aucun bento en route', () => {
    const rows = buildUserRows(
      [profile('a')],
      [
        bento('a', { slots: 6, published_at: '2026-03-01T00:00:00Z' }),
        secondaire('a', { slots: 4, published_at: '2026-04-01T00:00:00Z' }),
        secondaire('a', { slots: 1 }),
      ],
      new Set(['a']),
    );
    const a = rows.find((r) => r.id === 'a');
    assert.equal(a?.bentoCount, 3, 'la suppression du compte en effacera trois');
    assert.equal(a?.publishedCount, 2);
  });

  it('dit zéro et non « undefined » pour un compte sans bento', () => {
    const rows = buildUserRows([profile('z')], [], new Set(['z']));
    const z = rows.find((r) => r.id === 'z');
    assert.equal(z?.bentoCount, 0);
    assert.equal(z?.publishedCount, 0);
    assert.equal(z?.slots, 0);
  });
});
