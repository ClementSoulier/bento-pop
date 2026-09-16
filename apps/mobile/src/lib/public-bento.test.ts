import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { paletteKeyForItem } from '@bento-pop/supabase-mobile/bento';
import { bentoRows, mapPublicBento, type PublicBentoRow } from './public-bento';

/** Six décimales : la précision d'un `timestamptz`, à reprendre telle quelle. */
const PUBLISHED = '2026-09-08T15:49:11.227431+00:00';

type BentoRow = Exclude<NonNullable<PublicBentoRow['bentos']>, readonly unknown[]>;
type Links = NonNullable<BentoRow['bento_items']>;

const item = (
  id: string,
  title: string,
  extra: Partial<NonNullable<Links[number]['items']>> = {},
) => ({
  id,
  title,
  subtitle: null,
  image_url: null,
  image_credit: null,
  ...extra,
});

/** Six cases complètes, titres distinctifs pour les assertions. */
const fullLinks: Links = [
  { category_id: 1, items: item('it-film', 'Le Seigneur des anneaux') },
  { category_id: 2, items: item('it-serie', 'Game of Thrones') },
  { category_id: 3, items: item('it-artiste', 'Hiroyuki Sawano') },
  { category_id: 4, items: item('it-chanson', 'Merry-Go-Round of Life') },
  { category_id: 5, items: item('it-crea', 'Joyca') },
  { category_id: 6, items: item('it-lieu', 'Ardèche') },
];

const row = (
  overrides: Partial<PublicBentoRow> = {},
  bento: Partial<BentoRow> = {},
): PublicBentoRow => ({
  pseudo: 'dark_hifus',
  display_name: null,
  kind: 'member',
  bentos: {
    id: 'b-principal',
    slug: 'mon-bento',
    is_primary: true,
    published_at: PUBLISHED,
    is_featured: false,
    bento_items: fullLinks,
    ...bento,
  },
  ...overrides,
});

describe('mapPublicBento', () => {
  it('mappe un bento en ligne complet', () => {
    const result = mapPublicBento(row({ display_name: 'Florian' }, { is_featured: true }));
    const bento = result.bento;
    assert.ok(bento);
    assert.equal(result.pseudo, 'dark_hifus');
    assert.equal(bento.pseudo, 'dark_hifus');
    assert.equal(bento.displayName, 'Florian');
    assert.equal(bento.isFeatured, true);
    assert.equal(bento.isGuest, false);
    assert.equal(Object.keys(bento.slots).length, 6);
    assert.equal(bento.slots.film?.title, 'Le Seigneur des anneaux');
    assert.equal(bento.slots.place?.title, 'Ardèche');
  });

  it('reprend `published_at` sans le reformater', () => {
    assert.equal(mapPublicBento(row()).bento?.publishedAt, PUBLISHED);
  });

  /**
   * Mention légale CC-BY-SA : la perdre au mapping la ferait disparaître de
   * l'écran sans que rien ne casse.
   */
  it('propage l’image, son crédit et le sous-titre', () => {
    const result = mapPublicBento(
      row(
        {},
        {
          bento_items: [
            {
              category_id: 6,
              items: item('it-lieu', 'Ardèche', {
                subtitle: 'France',
                image_url: 'https://example.test/pont-d-arc.jpg',
                image_credit: 'Jan Hager, CC BY-SA 4.0',
              }),
            },
          ],
        },
      ),
    );
    const place = result.bento?.slots.place;
    assert.equal(place?.subtitle, 'France');
    assert.equal(place?.imageUrl, 'https://example.test/pont-d-arc.jpg');
    assert.equal(place?.imageCredit, 'Jan Hager, CC BY-SA 4.0');
  });

  it('attribue les palettes déterministes du domaine partagé', () => {
    const slots = mapPublicBento(row()).bento?.slots;
    assert.equal(slots?.film?.paletteKey, paletteKeyForItem('it-film'));
    assert.equal(slots?.track?.paletteKey, paletteKeyForItem('it-chanson'));
  });

  it('garde le pseudo tel qu’il est écrit en base', () => {
    // Le lien peut arriver en minuscules, la base dit comment le pseudo s'écrit.
    assert.equal(mapPublicBento(row({ pseudo: 'Dark_Hifus' })).pseudo, 'Dark_Hifus');
  });

  it('préserve un `display_name` nul plutôt que de le vider', () => {
    assert.equal(mapPublicBento(row()).bento?.displayName, null);
  });

  it('reconnaît le bento invité, et lui seul', () => {
    assert.equal(mapPublicBento(row({ kind: 'editorial' })).bento?.isGuest, true);
    // Une valeur ajoutée en base avant les clients se lit « pas invité ».
    assert.equal(mapPublicBento(row({ kind: 'futur' })).bento?.isGuest, false);
  });

  it('ne dépend pas de l’ordre des cases', () => {
    const forward = mapPublicBento(row());
    const reversed = mapPublicBento(row({}, { bento_items: [...fullLinks].reverse() }));
    assert.deepEqual(reversed.bento?.slots, forward.bento?.slots);
  });
});

describe('mapPublicBento, « rien en ligne » et « introuvable » sont deux choses', () => {
  /**
   * La jointure externe rend la ligne d'un compte sans bento publié avec
   * `bentos: null`. C'est ce qui permet à l'écran de dire « @x n'a pas de
   * bento en ligne » au lieu de « Bento introuvable ».
   */
  it('rend le pseudo sans bento quand rien n’est en ligne', () => {
    assert.deepEqual(mapPublicBento(row({ bentos: null })), {
      pseudo: 'dark_hifus',
      bento: null,
      others: [],
    });
  });

  /**
   * Impossible via le filtre de la requête, mais la RLS laisse son brouillon
   * à l'auteur : un filtre perdu ne doit pas afficher un brouillon comme
   * publié sur la page de son propriétaire.
   */
  it('lit un brouillon comme rien en ligne', () => {
    assert.equal(mapPublicBento(row({}, { published_at: null })).bento, null);
  });

  it('lit zéro case lisible comme rien en ligne, comme le fil', () => {
    const hidden = fullLinks.map((link) => ({ ...link, items: null }));
    assert.equal(
      mapPublicBento(row({}, { bento_items: hidden })).bento,
      null,
      'six cases masquées',
    );
    assert.equal(mapPublicBento(row({}, { bento_items: [] })).bento, null);
    assert.equal(mapPublicBento(row({}, { bento_items: null })).bento, null);
  });
});

describe('mapPublicBento, cases partielles', () => {
  /**
   * Item en attente ou rejeté après publication : la RLS le masque à tous
   * sauf à celui qui l'a proposé, et la jointure rend `items: null`. La case
   * devient vide, le bento reste en ligne.
   */
  it('rend vide une case dont l’item est masqué par la RLS', () => {
    const links = [...fullLinks.slice(0, 5), { category_id: 6, items: null }];
    const bento = mapPublicBento(row({}, { bento_items: links })).bento;
    assert.ok(bento, 'le bento doit rester en ligne');
    assert.equal(Object.keys(bento.slots).length, 5);
    assert.equal(bento.slots.place, undefined);
  });

  it('ignore une catégorie inconnue sans écraser de case', () => {
    const links = [...fullLinks, { category_id: 99, items: item('it-futur', 'Septième case') }];
    const slots = mapPublicBento(row({}, { bento_items: links })).bento?.slots;
    assert.equal(Object.keys(slots ?? {}).length, 6);
    assert.equal(slots?.film?.title, 'Le Seigneur des anneaux');
  });
});

/**
 * Chantier 16. Le point de bascule n'est pas « quelqu'un a deux bentos » mais
 * « la contrainte unique a été levée » : PostgREST rend alors un tableau même
 * pour un compte qui n'en a qu'un. Mesuré, cf. `docs/UX-16-PLUSIEURS-BENTOS.md`
 * §4.3.
 */
describe('bentoRows, les deux formes de la relation', () => {
  const one = {
    id: 'b-1',
    slug: 'mon-bento',
    is_primary: true,
    published_at: PUBLISHED,
    is_featured: false,
    bento_items: fullLinks,
  };

  it('accepte l’objet rendu tant que `bentos_user_id_key` existe', () => {
    assert.deepEqual(bentoRows(one), [one]);
  });

  it('accepte le tableau rendu une fois la contrainte levée', () => {
    assert.deepEqual(bentoRows([one]), [one]);
  });

  it('lit l’absence de bento comme une liste vide, jamais comme une erreur', () => {
    assert.deepEqual(bentoRows(null), []);
    assert.deepEqual(bentoRows([]), []);
  });
});

describe('mapPublicBento, plusieurs bentos par compte', () => {
  const secondaire = (over: Partial<BentoRow> = {}): BentoRow => ({
    id: 'b-hebdo',
    slug: 'hebdo-38',
    is_primary: false,
    published_at: '2026-09-15T10:00:00.000000+00:00',
    is_featured: false,
    bento_items: fullLinks,
    ...over,
  });

  const principal = (over: Partial<BentoRow> = {}): BentoRow => ({
    id: 'b-principal',
    slug: 'mon-bento',
    is_primary: true,
    published_at: PUBLISHED,
    is_featured: false,
    bento_items: fullLinks,
    ...over,
  });

  it('met en avant le principal, quel que soit l’ordre rendu par PostgREST', () => {
    for (const liste of [
      [principal(), secondaire()],
      [secondaire(), principal()],
    ]) {
      const result = mapPublicBento(row({ bentos: liste }));
      assert.equal(result.bento?.slug, 'mon-bento');
      assert.deepEqual(
        result.others.map((o) => o.slug),
        ['hebdo-38'],
      );
    }
  });

  /**
   * Le défaut mesuré côté landing : `raw[0]` tombait parfois sur un brouillon
   * et la page annonçait « rien en ligne » alors qu'un bento publié existait.
   * Ici le brouillon est déjà écarté par le filtre de la requête ; ce test
   * verrouille le cas où il passerait quand même.
   */
  it('ne dit jamais « rien en ligne » quand un bento l’est', () => {
    const result = mapPublicBento(
      row({ bentos: [principal({ published_at: null }), secondaire()] }),
    );
    assert.equal(result.bento?.slug, 'hebdo-38', 'le publié doit être montré');
    assert.deepEqual(result.others, [], 'le brouillon ne se liste pas');
  });

  it('classe les autres du plus ancien au plus récent', () => {
    const vieux = secondaire({ id: 'b-vieux', slug: 'archives-2025', published_at: '2025-01-01T00:00:00.000000+00:00' });
    const result = mapPublicBento(row({ bentos: [secondaire(), principal(), vieux] }));
    assert.deepEqual(
      result.others.map((o) => o.slug),
      ['archives-2025', 'hebdo-38'],
    );
  });

  it('n’a rien à lister tant qu’un compte n’a qu’un bento', () => {
    // La promesse de §5.4 : rien ne change à l'écran avant le deuxième.
    assert.deepEqual(mapPublicBento(row({ bentos: [principal()] })).others, []);
  });

  it('rend le bento que le slug nomme, et liste les autres', () => {
    const result = mapPublicBento(row({ bentos: [principal(), secondaire()] }), 'hebdo-38');
    assert.equal(result.bento?.slug, 'hebdo-38');
    assert.deepEqual(
      result.others.map((o) => o.slug),
      ['mon-bento'],
      'la page d’un bento nommé doit mener au principal',
    );
  });

  it('ne retombe jamais sur le principal pour un slug inconnu', () => {
    const result = mapPublicBento(row({ bentos: [principal(), secondaire()] }), 'jamais-publie');
    assert.equal(result.bento, null);
    assert.deepEqual(result.others, []);
  });

  it('porte l’identité du bento choisi, pas celle du compte', () => {
    const bento = mapPublicBento(row({ bentos: [principal(), secondaire()] })).bento;
    assert.equal(bento?.id, 'b-principal');
    assert.equal(bento?.isPrimary, true);
    assert.equal(bento?.publishedAt, PUBLISHED);
  });
});
