import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { TileSize } from './layout';
import { webTitleClamped, webTitleLines } from './title-clamp';

/**
 * Lignes relevées sur la page publique le 17 septembre 2026, build de
 * production, dans Chrome 152 et WebKit (macOS 26.6), à 375 et 1280 px de large :
 * titre, gabarit, lignes dans Chrome, lignes dans WebKit.
 *
 * Titres du bento de dark_hifus, et titres d'essai dont la 3e ligne porte un
 * accent, ou la dernière un Q ou une virgule.
 */
const RELEVES: readonly (readonly [string, TileSize, number, number])[] = [
  ['Été indien à Ölüdeniz', 'lg', 2, 2],
  ["Il était une fois dans l'Ouest et Ölüdeniz", 'lg', 3, 3],
  ['Le Bon, la Brute et le Truand, Été', 'lg', 2, 2],
  ["Le Seigneur des anneaux : La Communauté de l'anneau", 'lg', 4, 4],
  ['les 4 Fantastiques', 'lg', 2, 2],
  ['Les Aventures extraordinaires de Tintin Être et paraître', 'lg', 4, 4],
  ['Les Chevaliers du Zodiaque Noël éternel', 'lg', 3, 3],
  ["Les Chevaliers du Zodiaque, Noël d'Hadès", 'lg', 3, 3],
  ['Les Pingouins de Madagascar Ångström', 'lg', 3, 3],
  ['Ève et Ölüdeniz', 'md', 2, 2],
  ['Game of Thrones', 'md', 2, 2],
  ['La Casa de Papel, Être ou paraître', 'md', 3, 3],
  ['La Musique, Épique', 'md', 2, 2],
  ["Les Mystérieuses Cités d'or", 'md', 4, 4],
  ['Mötley Crüe Live Ëlle', 'md', 3, 3],
  ['Mötley Crüe Live Noël', 'md', 3, 3],
  ['Motörhead Live Ölüdeniz', 'md', 3, 3],
  ['Nordic Sounds Ålesund', 'md', 3, 3],
  ['Queen Musique', 'md', 2, 2],
  ['浦沢直樹', 'md', 1, 1],
  ['Ardèche', 'sm', 1, 1],
  ['Bigflo Live Êtres', 'sm', 2, 2],
  ['Björk Club Ëlle', 'sm', 2, 2],
  ['Björk Live Club Ëlle', 'sm', 3, 3],
  ['Élan vital', 'sm', 2, 2],
  ['Hugo Tout Seul Été', 'sm', 3, 3],
  ['Jazz Club Live Åland', 'sm', 3, 3],
  ['Jazz Live Åland', 'sm', 2, 2],
  ['Joyca', 'sm', 1, 1],
  ['La Quête, Qu', 'sm', 2, 2],
  ['Live Club Noël', 'sm', 2, 2],
  ['Merry-Go-Round of Life', 'sm', 3, 4],
  ['Oli Live Club Êtres', 'sm', 3, 3],
  ['Soleil Rouge Öland', 'sm', 3, 3],
  ['Squeezie', 'sm', 1, 1],
  ['ロストアンブレラ', 'sm', 2, 2],
];

describe('webTitleLines ne compte jamais moins de lignes que le navigateur', () => {
  it('sur les titres relevés dans Chrome et WebKit', () => {
    const sousEstimes = RELEVES.filter(([titre, taille, chrome, webkit]) => {
      // Au-delà de trois, le nombre exact ne change rien : le titre est coupé.
      const navigateur = Math.min(Math.max(chrome, webkit), 3);
      return webTitleLines(titre, taille) < navigateur;
    });
    assert.deepEqual(sousEstimes, []);
  });
});

describe('webTitleClamped', () => {
  it('coupe le Seigneur des anneaux dans la grande case, comme sur la page de dark_hifus', () => {
    assert.equal(
      webTitleClamped("Le Seigneur des anneaux : La Communauté de l'anneau", 'lg'),
      true,
    );
  });

  it('reconnaît chaque titre coupé relevé', () => {
    const manques = RELEVES.filter(
      ([titre, taille, chrome, webkit]) =>
        Math.max(chrome, webkit) > 2 && !webTitleClamped(titre, taille),
    );
    assert.deepEqual(manques, []);
  });

  it('laisse entier un titre de deux lignes, dont la dernière porte un Q ou une virgule', () => {
    for (const [titre, taille] of [
      ['les 4 Fantastiques', 'lg'],
      ['Le Bon, la Brute et le Truand, Été', 'lg'],
      ['La Musique, Épique', 'md'],
      ['La Quête, Qu', 'sm'],
    ] as const) {
      assert.equal(webTitleClamped(titre, taille), false, titre);
    }
  });

  it('laisse entier un mot seul', () => {
    assert.equal(webTitleClamped('Squeezie', 'sm'), false);
    assert.equal(webTitleClamped('Ardèche', 'sm'), false);
  });

  it('compte un idéogramme pour 1 em, et non pour le plus large glyphe d’Extenda', () => {
    // Case publiée, sur deux lignes : à 1,47 em le caractère, elle en comptait trois.
    assert.equal(webTitleLines('ロストアンブレラ', 'sm'), 2);
    assert.equal(webTitleLines('浦沢直樹', 'md'), 1);
  });

  it('coupe un mot plus large que la ligne, comme `overflow-wrap: anywhere`', () => {
    // Trois lignes dans Chrome et dans WebKit, petite case à 375 px.
    assert.equal(webTitleLines('Anticonstitutionnellement', 'sm'), 3);
  });

  it('ne compte aucune ligne pour un titre vide', () => {
    assert.equal(webTitleLines('', 'lg'), 0);
    assert.equal(webTitleClamped('  ', 'sm'), false);
  });
});
