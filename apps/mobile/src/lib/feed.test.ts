import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { paletteKeyForItem } from '@bento-pop/supabase-mobile/bento';
import { cursorOf, feedAccessibilityLabel, mapFeedRow, type FeedRow } from './feed';

const NOW = Date.parse('2026-09-11T12:00:00.000Z');
const PUBLISHED = '2026-09-08T15:49:11.227+00:00';

const item = (id: string, title: string, extra: Partial<NonNullable<
  NonNullable<FeedRow['bento_items']>[number]['items']
>> = {}) => ({
  id,
  title,
  subtitle: null,
  image_url: null,
  image_credit: null,
  ...extra,
});

/** Six cases complètes, titres distinctifs pour les assertions. */
const fullLinks: NonNullable<FeedRow['bento_items']> = [
  { category_id: 1, items: item('it-film', 'Interstellar') },
  { category_id: 2, items: item('it-serie', 'Severance') },
  { category_id: 3, items: item('it-artiste', 'Orelsan') },
  { category_id: 4, items: item('it-chanson', 'La Quête') },
  { category_id: 5, items: item('it-crea', 'Squeezie') },
  { category_id: 6, items: item('it-lieu', 'Japan Expo') },
];

const row = (overrides: Partial<FeedRow> = {}): FeedRow => ({
  id: 'b-1',
  published_at: PUBLISHED,
  is_featured: false,
  users: { pseudo: 'dark_hifus', display_name: 'Florian', kind: 'member' },
  bento_items: fullLinks,
  ...overrides,
});

describe('mapFeedRow', () => {
  it('mappe une ligne nominale', () => {
    const bento = mapFeedRow(row());
    assert.ok(bento);
    assert.equal(bento.bentoId, 'b-1');
    assert.equal(bento.pseudo, 'dark_hifus');
    assert.equal(bento.displayName, 'Florian');
    assert.equal(bento.isFeatured, false);
    assert.equal(Object.keys(bento.slots).length, 6);
    assert.equal(bento.slots.film?.title, 'Interstellar');
    assert.equal(bento.slots.place?.title, 'Japan Expo');
  });

  it('reprend `published_at` sans le reformater', () => {
    // Le fil trie dessus et la pagination s'en sert de curseur : toute
    // normalisation ici se paierait par des lignes sautées.
    assert.equal(mapFeedRow(row())?.publishedAt, PUBLISHED);
  });

  it('propage le crédit d’image', () => {
    // Mention légale CC-BY-SA. La perdre au mapping la ferait disparaître de
    // l'écran sans que rien ne casse.
    const bento = mapFeedRow(
      row({
        bento_items: [
          {
            category_id: 1,
            items: item('it-film', 'Ardèche', {
              image_url: 'https://example.test/a.jpg',
              image_credit: 'Jean Dupont, CC BY-SA 4.0',
            }),
          },
        ],
      }),
    );
    assert.equal(bento?.slots.film?.imageCredit, 'Jean Dupont, CC BY-SA 4.0');
    assert.equal(bento?.slots.film?.imageUrl, 'https://example.test/a.jpg');
  });

  it('préserve un `display_name` nul plutôt que de le vider', () => {
    // `null` et `''` ne se rendent pas pareil : l'étiquette d'identité affiche
    // une seconde ligne vide dans le second cas.
    assert.equal(mapFeedRow(row({ users: { pseudo: 'x', display_name: null, kind: 'member' } }))?.displayName, null);
  });

  it('attribue les palettes déterministes du domaine partagé', () => {
    const bento = mapFeedRow(row());
    assert.equal(bento?.slots.film?.paletteKey, paletteKeyForItem('it-film'));
    assert.equal(bento?.slots.series?.paletteKey, paletteKeyForItem('it-serie'));
  });

  it('écarte la ligne quand l’utilisateur est absent', () => {
    // Relation cassée : la carte mènerait à un cul-de-sac.
    assert.equal(mapFeedRow(row({ users: null })), null);
  });

  it('écarte la ligne quand `published_at` est nul', () => {
    assert.equal(mapFeedRow(row({ published_at: null })), null);
  });

  it('écarte la ligne quand aucune case n’est lisible', () => {
    assert.equal(mapFeedRow(row({ bento_items: [] })), null);
    assert.equal(mapFeedRow(row({ bento_items: null })), null);
    assert.equal(
      mapFeedRow(row({ bento_items: [{ category_id: 1, items: null }] })),
      null,
      'six cases masquées par la RLS = boîte vide, pas un post',
    );
  });

  it('ignore une case isolée sans écarter la ligne', () => {
    // Item `pending` : la RLS le masque à tout le monde sauf à son auteur.
    // La case devient vide, le bento reste publiable et affichable.
    const bento = mapFeedRow(
      row({ bento_items: [...fullLinks.slice(0, 5), { category_id: 6, items: null }] }),
    );
    assert.ok(bento);
    assert.equal(Object.keys(bento.slots).length, 5);
    assert.equal(bento.slots.place, undefined);
  });

  it('ignore une catégorie inconnue', () => {
    // Une 7e catégorie déployée en base avant les clients ne doit rien casser.
    const bento = mapFeedRow(
      row({ bento_items: [...fullLinks, { category_id: 99, items: item('it-x', 'Futur') }] }),
    );
    assert.equal(Object.keys(bento?.slots ?? {}).length, 6);
  });
});

describe('cursorOf', () => {
  it('reprend la chaîne PostgREST caractère pour caractère', () => {
    // Six décimales : c'est la précision d'un `timestamptz`. Un passage par
    // `new Date(...).toISOString()` la ramènerait à trois et sauterait les
    // lignes intermédiaires.
    const microseconds = '2026-08-26T22:10:09.227431+00:00';
    const cursor = cursorOf(row({ published_at: microseconds }));
    assert.equal(cursor?.publishedAt, microseconds);
    assert.notEqual(cursor?.publishedAt, new Date(microseconds).toISOString());
  });

  it('renvoie null sans date de publication', () => {
    assert.equal(cursorOf(row({ published_at: null })), null);
  });
});

describe('feedAccessibilityLabel', () => {
  it('énumère la composition dans l’ordre canonique', () => {
    const bento = mapFeedRow(row());
    assert.ok(bento);
    assert.equal(
      feedAccessibilityLabel(bento, NOW),
      'Bento de @dark_hifus, publié il y a 2 jours. ' +
        'Film : Interstellar. Série : Severance. Artiste : Orelsan. ' +
        'Chanson : La Quête. Créateur de contenu : Squeezie. Lieu : Japan Expo.',
    );
  });

  it('annonce le coup de cœur', () => {
    const bento = mapFeedRow(row({ is_featured: true }));
    assert.ok(bento);
    assert.match(feedAccessibilityLabel(bento, NOW), /Coup de cœur de l'équipe\./);
  });

  it('omet les cases vides plutôt que d’énoncer « undefined »', () => {
    const bento = mapFeedRow(row({ bento_items: fullLinks.slice(0, 2) }));
    assert.ok(bento);
    const label = feedAccessibilityLabel(bento, NOW);
    assert.ok(!label.includes('undefined'), label);
    assert.ok(!label.includes('Lieu'), label);
    assert.match(label, /Film : Interstellar\. Série : Severance\./);
  });

  it('omet la mention de date quand elle est inexploitable', () => {
    const bento = mapFeedRow(row());
    assert.ok(bento);
    const label = feedAccessibilityLabel({ ...bento, publishedAt: 'nawak' }, NOW);
    assert.match(label, /^Bento de @dark_hifus\. Film/);
  });
});
