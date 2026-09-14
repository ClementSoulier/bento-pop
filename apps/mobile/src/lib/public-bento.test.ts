import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { paletteKeyForItem } from '@bento-pop/supabase-mobile/bento';
import { mapPublicBento, type PublicBentoRow } from './public-bento';

/** Six décimales : la précision d'un `timestamptz`, à reprendre telle quelle. */
const PUBLISHED = '2026-09-08T15:49:11.227431+00:00';

type BentoRow = NonNullable<PublicBentoRow['bentos']>;
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
  bentos: { published_at: PUBLISHED, is_featured: false, bento_items: fullLinks, ...bento },
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
    assert.deepEqual(mapPublicBento(row({ bentos: null })), { pseudo: 'dark_hifus', bento: null });
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
