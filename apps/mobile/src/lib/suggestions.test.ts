import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  SUGGESTIONS_COUNT,
  mapSuggestionRow,
  suggestionAccessibilityLabel,
  type SuggestedItem,
  type SuggestionRow,
} from './suggestions';

const row = (over: Partial<SuggestionRow> = {}): SuggestionRow => ({
  id: 'item-1',
  title: 'Inception',
  subtitle: '2010',
  year: 2010,
  image_url: 'https://image.tmdb.org/t/p/w500/a.jpg',
  image_credit: 'Affiche : TMDb',
  picks: 2,
  ...over,
});

const item = (over: Partial<SuggestedItem> = {}): SuggestedItem => ({
  id: 'item-1',
  title: 'Inception',
  subtitle: '2010',
  imageUrl: null,
  imageCredit: null,
  picks: 0,
  ...over,
});

describe('mapSuggestionRow', () => {
  it('reprend chaque champ à sa place', () => {
    assert.deepEqual(mapSuggestionRow(row()), {
      id: 'item-1',
      title: 'Inception',
      subtitle: '2010',
      imageUrl: 'https://image.tmdb.org/t/p/w500/a.jpg',
      imageCredit: 'Affiche : TMDb',
      picks: 2,
    });
  });

  it('laisse les champs optionnels à null plutôt que undefined', () => {
    const mapped = mapSuggestionRow(
      row({ subtitle: null, image_url: null, image_credit: null }),
    );
    assert.equal(mapped.subtitle, null);
    assert.equal(mapped.imageUrl, null);
    assert.equal(mapped.imageCredit, null);
  });

  /**
   * Le `coalesce` SQL garantit un entier, mais un `picks` manquant qui
   * remonterait tel quel produirait « choisi undefined fois » dans le libellé
   * VoiceOver. Le plancher est ici pour que ce cas n'existe pas.
   */
  it('ramène picks à 0 quand il est absent ou nul', () => {
    for (const value of [null, undefined]) {
      const mapped = mapSuggestionRow(row({ picks: value as never }));
      assert.equal(mapped.picks, 0, `picks ${String(value)}`);
    }
  });

  it('ne perd pas un picks légitime, y compris 0', () => {
    assert.equal(mapSuggestionRow(row({ picks: 0 })).picks, 0);
    assert.equal(mapSuggestionRow(row({ picks: 7 })).picks, 7);
  });
});

describe('suggestionAccessibilityLabel', () => {
  it('énonce le titre nettoyé et le sous-titre', () => {
    assert.equal(
      suggestionAccessibilityLabel(item({ title: 'Inception (film)', subtitle: '2010' })),
      'Inception, 2010',
    );
  });

  it('omet le sous-titre absent', () => {
    assert.equal(suggestionAccessibilityLabel(item({ subtitle: null })), 'Inception');
  });

  /**
   * Le point qui compte. Annoncer « choisi 1 fois » vendrait une popularité
   * que les données ne portent pas : au 12 septembre 2026, une catégorie
   * entière (« Chanson ») n'a que des items à 1. Quelqu'un qui ne voit pas la
   * grille ne peut pas en juger, donc on se tait.
   */
  it('reste muet sur le nombre de choix en dessous de 2', () => {
    for (const picks of [0, 1]) {
      const label = suggestionAccessibilityLabel(item({ picks }));
      assert.ok(!label.includes('choisi'), `picks=${picks} a annoncé « ${label} »`);
    }
  });

  it('annonce le nombre de choix à partir de 2', () => {
    assert.equal(suggestionAccessibilityLabel(item({ picks: 2 })), 'Inception, 2010, choisi 2 fois');
    assert.equal(suggestionAccessibilityLabel(item({ picks: 11 })), 'Inception, 2010, choisi 11 fois');
  });

  it('ne produit jamais de virgule orpheline', () => {
    for (const picks of [0, 1, 2, 5]) {
      for (const subtitle of [null, '', '2010']) {
        const label = suggestionAccessibilityLabel(item({ picks, subtitle }));
        assert.ok(!label.includes(', ,'), `virgule orpheline : « ${label} »`);
        assert.ok(!label.endsWith(','), `virgule finale : « ${label} »`);
        assert.ok(label.length > 0);
      }
    }
  });
});

describe('SUGGESTIONS_COUNT', () => {
  /**
   * La grille est en 3 colonnes (`numColumns={3}`). Un compte non multiple de
   * 3 laisserait une rangée incomplète en bas, ce qui se voit immédiatement
   * sur une grille de tuiles cadrées.
   */
  it('remplit des rangées entières de trois', () => {
    assert.equal(SUGGESTIONS_COUNT % 3, 0);
    assert.ok(SUGGESTIONS_COUNT >= 9 && SUGGESTIONS_COUNT <= 15, 'compromis remplissage / egress');
  });
});
