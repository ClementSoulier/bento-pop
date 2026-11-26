import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ITEM_GRID,
  itemCardAccessibilityLabel,
  itemCardHeight,
  itemColumnWidth,
  itemGridRows,
} from './item-grid-rules';

/** La largeur d'une feuille moins ses marges de 20 : iPhone SE, iPhone 17 Pro, Pixel 8. */
const SE = 375 - 40;
const PRO = 402 - 40;
const PIXEL = 411 - 40;

describe('la grille des résultats d’une case (chantier 32, lot 3)', () => {
  it('pose trois colonnes aux mesures de la maquette', () => {
    // `c02` à l'iPhone 17 Pro : des affiches de 114 sur 171.
    assert.equal(itemColumnWidth(PRO), 114);
    assert.equal(itemColumnWidth(SE), 105);
    assert.ok(Math.abs(itemColumnWidth(PIXEL) - 117) < 0.01);
  });

  it('remplit sa largeur, gouttières comprises', () => {
    for (const width of [SE, PRO, PIXEL, 1000]) {
      const used = itemColumnWidth(width) * ITEM_GRID.columns + 2 * ITEM_GRID.columnGap;
      assert.ok(Math.abs(used - width) < 1e-9, `${used} pour ${width}`);
    }
  });

  it('ne rend jamais une colonne nulle ou négative', () => {
    for (const width of [0, -10, 5, 20]) assert.ok(itemColumnWidth(width) >= 1, `${width}`);
  });

  it('range les items par trois, et la dernière rangée garde ses trous', () => {
    assert.deepEqual(itemGridRows([]), []);
    assert.deepEqual(itemGridRows(['a']), [['a', null, null]]);
    assert.deepEqual(itemGridRows(['a', 'b', 'c']), [['a', 'b', 'c']]);
    assert.deepEqual(itemGridRows(['a', 'b', 'c', 'd']), [
      ['a', 'b', 'c'],
      ['d', null, null],
    ]);
    // Douze suggestions, quatre rangées pleines ; vingt résultats, sept rangées.
    assert.equal(itemGridRows(Array.from({ length: 12 }, (_, i) => i)).length, 4);
    assert.equal(itemGridRows(Array.from({ length: 20 }, (_, i) => i)).length, 7);
  });

  /**
   * Le critère C3 du chantier 3 : lever le clavier d'emblée ne doit pas cacher
   * les propositions. Les places viennent d'une mesure au pixel, le 26 novembre
   * 2026, clavier français levé, barre de suggestions comprise : le haut de la
   * grille et le haut du clavier, dans la feuille du design. Si quelqu'un
   * agrandit l'en-tête de la feuille ou les affiches, il apprend ici ce qu'il
   * vient de cacher.
   */
  it('laisse les propositions au-dessus du clavier', () => {
    // iPhone 17 Pro : la grille à 259, le clavier à 539,7. Une rangée entière, titre
    // sur deux lignes et année, et le haut de la suivante qui dépasse.
    const pro = 539.7 - 259;
    const rowPro = itemCardHeight(itemColumnWidth(PRO), 2, true);
    assert.ok(rowPro < pro, `${rowPro} pour ${pro}`);
    assert.ok(pro - rowPro - ITEM_GRID.rowGap > 30, `la rangée suivante ne dépasse plus`);
    // iPhone SE : la grille à 217, le clavier à 408. Les affiches et la première ligne
    // de leur titre tiennent ; l'année passe sous le clavier, de 8,5 points, et se lit
    // en défilant ou clavier baissé. Une limite de la feuille du design, mesurée.
    const se = 408 - 217;
    const shownSe = itemCardHeight(itemColumnWidth(SE), 1, false);
    assert.ok(shownSe < se, `${shownSe} pour ${se}`);
    assert.ok(se - shownSe > 5, `marge trop courte : ${(se - shownSe).toFixed(1)} pt`);
    assert.ok(Math.abs(itemCardHeight(itemColumnWidth(SE), 1, true) - se - 8.5) < 0.01);
  });

  it('dit l’item comme la recherche depuis le chantier 3', () => {
    assert.equal(itemCardAccessibilityLabel('Inception', '2010'), 'Choisir Inception, 2010');
    assert.equal(itemCardAccessibilityLabel('Ponyo'), 'Choisir Ponyo');
    assert.equal(itemCardAccessibilityLabel('Ponyo', null), 'Choisir Ponyo');
  });
});
