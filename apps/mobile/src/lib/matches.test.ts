import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  matchAccessibilityLabel,
  matchReasonLabel,
  matchRoute,
  matchesPillAccessibilityLabel,
  matchesPillLabel,
  parseMatchRow,
  withoutBlocked,
  type BentoMatch,
} from './matches';
import { blockedIndex } from './blocked-accounts';

const row = (over: Record<string, unknown> = {}) => ({
  bento_id: '3f2b8c1e-5d4a-4b6f-9e0d-1a2b3c4d5e6f',
  slug: 'mon-bento',
  is_primary: true,
  pseudo: 'alice',
  display_name: 'Alice',
  edition_title: null,
  shared: 2,
  score: 0.75,
  items: [
    { id: 'i1', title: 'Dune', category_id: 1 },
    { id: 'i2', title: 'Arcane', category_id: 2 },
  ],
  user_id: 'u-alice',
  avatar: 'nani',
  ...over,
});

const match = (over: Record<string, unknown> = {}) => parseMatchRow(row(over))!;

describe('parseMatchRow', () => {
  it('garde une ligne complète, ses items dans l’ordre de la base', () => {
    assert.deepEqual(parseMatchRow(row()), {
      bentoId: '3f2b8c1e-5d4a-4b6f-9e0d-1a2b3c4d5e6f',
      slug: 'mon-bento',
      isPrimary: true,
      userId: 'u-alice',
      pseudo: 'alice',
      displayName: 'Alice',
      avatar: 'nani',
      editionTitle: null,
      shared: 2,
      score: 0.75,
      items: [
        { id: 'i1', title: 'Dune', categoryId: 1 },
        { id: 'i2', title: 'Arcane', categoryId: 2 },
      ],
    });
  });

  it('écarte une ligne sans bento, sans adresse ou sans pseudo', () => {
    assert.equal(parseMatchRow(row({ bento_id: null })), null);
    assert.equal(parseMatchRow(row({ slug: '' })), null);
    assert.equal(parseMatchRow(row({ pseudo: 42 })), null);
    assert.equal(parseMatchRow(null), null);
    assert.equal(parseMatchRow('ligne'), null);
  });

  it('écarte un match sans item lisible : il ne dirait pas pourquoi', () => {
    assert.equal(parseMatchRow(row({ items: [] })), null);
    assert.equal(parseMatchRow(row({ items: null })), null);
    assert.equal(parseMatchRow(row({ items: [{ id: 'i1', title: '  ' }] })), null);
  });

  it('garde les items lisibles parmi d’autres, et nettoie les titres', () => {
    const parsed = parseMatchRow(
      row({ items: [{ id: 'i1', title: 'Dune (2021)' }, { title: 'sans id' }, 'texte'] }),
    );
    assert.deepEqual(parsed?.items, [{ id: 'i1', title: 'Dune', categoryId: null }]);
  });

  it('ne compte jamais moins d’items communs que d’items lus', () => {
    assert.equal(match({ shared: 1 }).shared, 2);
    assert.equal(match({ shared: 'deux' }).shared, 2);
    assert.equal(match({ shared: 5 }).shared, 5);
  });

  it('lit le nom affiché et l’édition s’ils sont là, rien sinon', () => {
    assert.equal(match({ display_name: '  ' }).displayName, null);
    assert.equal(
      match({ edition_title: 'La semaine du film qui pique' }).editionTitle,
      'La semaine du film qui pique',
    );
    assert.equal(match({ is_primary: 'oui' }).isPrimary, false);
  });
});

describe('libellés', () => {
  const items = (n: number) =>
    ['Dune', 'Arcane', 'Severance', 'Joyca', 'Angers']
      .slice(0, n)
      .map((title, i) => ({ id: `i${i}`, title }));

  it('dit ce qu’ils ont en commun, trois au plus, les plus rares d’abord', () => {
    assert.equal(matchReasonLabel(match({ items: items(1), shared: 1 })), 'Dune en commun');
    assert.equal(
      matchReasonLabel(match({ items: items(2), shared: 2 })),
      'Dune et Arcane en commun',
    );
    assert.equal(
      matchReasonLabel(match({ items: items(3), shared: 3 })),
      'Dune, Arcane et Severance en commun',
    );
    assert.equal(
      matchReasonLabel(match({ items: items(4), shared: 4 })),
      'Dune, Arcane, Severance et 1 autre en commun',
    );
    assert.equal(
      matchReasonLabel(match({ items: items(5), shared: 5 })),
      'Dune, Arcane, Severance et 2 autres en commun',
    );
  });

  it('lit tout à VoiceOver et TalkBack, en un seul élément', () => {
    assert.equal(
      matchAccessibilityLabel(match()),
      'Bento de @alice : 2 items en commun, Dune et Arcane.',
    );
    assert.equal(
      matchAccessibilityLabel(match({ items: items(5), shared: 5 })),
      'Bento de @alice : 5 items en commun, Dune, Arcane, Severance, Joyca et Angers.',
    );
    assert.equal(
      matchAccessibilityLabel(
        match({ items: items(1), shared: 1, edition_title: 'La semaine du film qui pique' }),
      ),
      'Bento « La semaine du film qui pique » de @alice : 1 item en commun, Dune.',
    );
  });

  it('écrit la pastille, et la dit selon qu’on regarde son propre bento', () => {
    assert.equal(matchesPillLabel(3), 'Mêmes goûts · 3');
    assert.equal(
      matchesPillAccessibilityLabel(3, false),
      '3 bentos ont les mêmes goûts que celui-ci',
    );
    assert.equal(matchesPillAccessibilityLabel(1, true), '1 bento a les mêmes goûts que toi');
  });
});

describe('à l’écran', () => {
  it('écarte les comptes bloqués sur l’appareil, quelle que soit la casse', () => {
    const list: BentoMatch[] = [match({ pseudo: 'Alice' }), match({ pseudo: 'bob' })];
    assert.deepEqual(
      withoutBlocked(list, blockedIndex([{ userId: null, pseudo: 'alice' }])).map((m) => m.pseudo),
      ['bob'],
    );
  });

  it('écarte un compte bloqué qui a changé de pseudo depuis (chantier 21, D8)', () => {
    const list: BentoMatch[] = [match({ pseudo: 'nouveau', user_id: 'u-1' }), match({ pseudo: 'bob', user_id: 'u-2' })];
    assert.deepEqual(
      withoutBlocked(list, blockedIndex([{ userId: 'u-1', pseudo: 'ancien' }])).map((m) => m.pseudo),
      ['bob'],
    );
  });

  it('mène au bento du match, à l’adresse du compte pour son principal', () => {
    assert.equal(matchRoute(match()), '/u/alice');
    assert.equal(
      matchRoute(match({ is_primary: false, slug: 'mes-series' })),
      '/u/alice/mes-series',
    );
  });
});
