import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CATEGORY_ORDER } from '@bento-pop/supabase-mobile/bento';
import {
  COLUMNS,
  GRID_CHROME,
  searchPlaceholder,
  searchTileHeight,
  searchTileWidth,
} from './layout';

/** Largeurs de fenêtre réelles, en points. */
const SE = 375;
const IPHONE_17 = 402;
const PRO_MAX = 440;

/**
 * Espace libre entre le bas du dernier élément fixe et le haut du clavier,
 * mesuré au pixel sur des captures du 12 septembre 2026, clavier français
 * levé, barre d'accessoires comprise. Cf. `docs/UX-03-RECHERCHE-ITEM.md` §5.3.
 */
const ABOVE_KEYBOARD = { [SE]: 229.0, [IPHONE_17]: 332.6 } as const;

describe('searchTileWidth', () => {
  it('remplit la largeur utile, trois par rangée', () => {
    for (const width of [SE, IPHONE_17, PRO_MAX]) {
      const tile = searchTileWidth(width);
      const used = tile * COLUMNS + GRID_CHROME;
      // L'arrondi vers le bas peut laisser jusqu'à deux points inutilisés.
      assert.ok(used <= width, `déborde de ${used - width} pt à ${width} pt`);
      assert.ok(width - used < COLUMNS, `${width - used} pt perdus à ${width} pt`);
    }
  });

  it('rend les largeurs attendues sur les appareils réels', () => {
    assert.equal(searchTileWidth(SE), 107);
    assert.equal(searchTileWidth(IPHONE_17), 116);
  });

  /**
   * `useWindowDimensions` peut rendre 0 sur la première frame. Sans plancher,
   * la tuile prendrait une largeur négative et disparaîtrait.
   */
  it('ne rend jamais une largeur nulle ou négative', () => {
    for (const width of [0, -100, 1, 52, 53]) {
      assert.ok(searchTileWidth(width) >= 1, `largeur ${searchTileWidth(width)} pour ${width}`);
    }
  });

  it('est monotone', () => {
    let previous = 0;
    for (let width = 100; width <= 1200; width += 7) {
      const value = searchTileWidth(width);
      assert.ok(value >= previous, `régression à ${width} pt`);
      previous = value;
    }
  });
});

describe('une rangée doit tenir au-dessus du clavier', () => {
  /**
   * C'est le critère C3 de la spec, et la raison pour laquelle l'`autoFocus`
   * est défendable : lever le clavier ne doit pas cacher les propositions.
   *
   * Les hauteurs disponibles viennent d'une mesure au pixel, pas d'une
   * estimation. Ce test les fige : si quelqu'un agrandit les tuiles, il
   * apprend ici qu'il vient de vider l'écran d'ouverture sur iPhone SE.
   */
  it('laisse une rangée entière visible sur iPhone SE', () => {
    const row = searchTileHeight(SE);
    const free = ABOVE_KEYBOARD[SE];
    assert.ok(row < free, `la rangée déborde : ${row} pt pour ${free} pt`);
    assert.ok(free - row > 30, `marge trop courte : ${(free - row).toFixed(1)} pt`);
  });

  it('laisse dépasser le début de la rangée suivante sur iPhone 17', () => {
    const row = searchTileHeight(IPHONE_17);
    const free = ABOVE_KEYBOARD[IPHONE_17];
    assert.ok(row < free, `la rangée déborde : ${row} pt pour ${free} pt`);
    // L'affordance de défilement : on voit qu'il y a autre chose en dessous.
    assert.ok(free - row > 60, `pas assez de suivant visible : ${(free - row).toFixed(1)} pt`);
  });

  /**
   * L'iPhone SE est le budget serré : 45 pt de marge. Tout élément glissé
   * entre le champ et la grille les consomme. Ce test dit combien il en
   * reste, pour qu'on ne le découvre pas en capture.
   */
  it('chiffre la marge restante sur le plus petit écran', () => {
    const slack = ABOVE_KEYBOARD[SE] - searchTileHeight(SE);
    assert.ok(slack > 30 && slack < 60, `marge inattendue : ${slack.toFixed(1)} pt`);
  });
});

describe('searchPlaceholder', () => {
  /**
   * Repéré sur une capture de recette, pas par relecture : « Cherche un
   * chanson… » sur l'écran « Son », et « Cherche un série… » sur l'écran
   * « Série ». Deux écrans sur six.
   */
  it('accorde l\'article au genre du libellé', () => {
    assert.equal(searchPlaceholder('track'), 'Cherche une chanson…');
    assert.equal(searchPlaceholder('series'), 'Cherche une série…');
    assert.equal(searchPlaceholder('film'), 'Cherche un film…');
    assert.equal(searchPlaceholder('place'), 'Cherche un lieu…');
    assert.equal(searchPlaceholder('artist'), 'Cherche un artiste…');
    assert.equal(searchPlaceholder('creator'), 'Cherche un créateur de contenu…');
  });

  it('couvre les six catégories sans trou', () => {
    for (const cat of CATEGORY_ORDER) {
      const text = searchPlaceholder(cat);
      assert.match(text, /^Cherche une? .+…$/, `placeholder douteux pour ${cat} : ${text}`);
      assert.ok(!text.includes('undefined'), cat);
    }
  });
});
