import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CATEGORY_IDS } from '@bento-pop/supabase-mobile/bento';
import { filledCount, mapBentoItems, type RawBentoItemRow } from './map';

function itemRow(
  category: keyof typeof CATEGORY_IDS,
  overrides: Partial<NonNullable<RawBentoItemRow['items']>> & { id: string },
): RawBentoItemRow {
  return {
    category_id: CATEGORY_IDS[category],
    items: {
      title: `Titre ${overrides.id}`,
      subtitle: null,
      year: null,
      image_url: null,
      image_credit: null,
      ...overrides,
    },
  };
}

const FULL_BENTO: RawBentoItemRow[] = [
  itemRow('film', { id: 'item-film', title: 'Interstellar', year: 2014 }),
  itemRow('series', { id: 'item-series', title: 'Severance' }),
  itemRow('artist', { id: 'item-artist', title: 'Orelsan' }),
  itemRow('track', { id: 'item-track', title: 'La Quête' }),
  itemRow('creator', { id: 'item-creator', title: 'Squeezie' }),
  itemRow('place', { id: 'item-place', title: 'Japan Expo' }),
];

describe('mapBentoItems', () => {
  it('remplit les six cases et conserve les champs', () => {
    const slots = mapBentoItems(FULL_BENTO);

    assert.equal(filledCount(slots), 6);
    assert.deepEqual(Object.keys(slots).sort(), [
      'artist',
      'creator',
      'film',
      'place',
      'series',
      'track',
    ]);
    assert.equal(slots.film?.title, 'Interstellar');
    assert.equal(slots.film?.year, 2014);
    assert.equal(slots.film?.itemId, 'item-film');
  });

  /**
   * Le test central du chantier. PostgreSQL ne garantit aucun ordre de
   * lignes sans `ORDER BY` : si le rendu dépendait de l'index, le même
   * bento changerait d'apparence d'un chargement à l'autre et différerait
   * entre l'app, la page web et l'image de partage.
   */
  it("produit un résultat identique quel que soit l'ordre des lignes", () => {
    const straight = mapBentoItems(FULL_BENTO);
    const reversed = mapBentoItems([...FULL_BENTO].reverse());
    const shuffled = mapBentoItems([
      FULL_BENTO[3]!,
      FULL_BENTO[0]!,
      FULL_BENTO[5]!,
      FULL_BENTO[1]!,
      FULL_BENTO[4]!,
      FULL_BENTO[2]!,
    ]);

    assert.deepEqual(reversed, straight);
    assert.deepEqual(shuffled, straight);
  });

  it('inclut la palette dans cette stabilité', () => {
    const straight = mapBentoItems(FULL_BENTO);
    const reversed = mapBentoItems([...FULL_BENTO].reverse());

    for (const key of Object.keys(straight) as (keyof typeof straight)[]) {
      assert.equal(
        reversed[key]?.paletteKey,
        straight[key]?.paletteKey,
        `palette instable pour la case ${key}`,
      );
    }
  });

  /**
   * `bento_items_read_published` laisse passer la ligne de liaison dès que
   * le bento est publié, tandis que `items_read_validated_or_own_pending`
   * masque l'item s'il a été rejeté ou fusionné après coup. Le visiteur
   * anonyme reçoit donc une liaison sans item.
   */
  it('ignore une liaison dont l’item est masqué par la RLS', () => {
    const slots = mapBentoItems([
      ...FULL_BENTO.slice(0, 5),
      { category_id: CATEGORY_IDS.place, items: null },
    ]);

    assert.equal(filledCount(slots), 5);
    assert.equal(slots.place, undefined);
    assert.equal(slots.film?.title, 'Interstellar');
  });

  it('ignore une catégorie inconnue sans lever', () => {
    const slots = mapBentoItems([
      ...FULL_BENTO,
      { category_id: 99, items: { id: 'x', title: 'Jeu vidéo', subtitle: null, year: null, image_url: null, image_credit: null } },
    ]);

    assert.equal(filledCount(slots), 6);
  });

  it('accepte un bento partiel', () => {
    const slots = mapBentoItems(FULL_BENTO.slice(0, 3));

    assert.equal(filledCount(slots), 3);
    assert.equal(slots.track, undefined);
  });

  it('accepte une liste vide', () => {
    const slots = mapBentoItems([]);

    assert.deepEqual(slots, {});
    assert.equal(filledCount(slots), 0);
  });

  it('retient la première ligne en cas de doublon de catégorie', () => {
    const slots = mapBentoItems([
      itemRow('film', { id: 'premier', title: 'Premier' }),
      itemRow('film', { id: 'second', title: 'Second' }),
    ]);

    assert.equal(filledCount(slots), 1);
    assert.equal(slots.film?.title, 'Premier');
  });

  it('préserve les valeurs nulles sans les transformer en undefined', () => {
    const slots = mapBentoItems([itemRow('film', { id: 'nu' })]);

    assert.equal(slots.film?.subtitle, null);
    assert.equal(slots.film?.imageUrl, null);
    assert.equal(slots.film?.imageCredit, null);
    assert.equal(slots.film?.year, null);
  });
});
