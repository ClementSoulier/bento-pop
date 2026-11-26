import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CATEGORY_ORDER } from '@bento-pop/supabase-mobile/bento';
import {
  BENTO_ROWS,
  emptyBentoLabel,
  illustrationScale,
  plateMinHeight,
  tileMinHeights,
  tilePrompt,
  tilePromptType,
} from './bento-rules';

/** Le bento vide du design (chantier 31, D3), aux mesures de `bundle.css`. */
describe('le bento vide', () => {
  it('range les six catégories dans l’ordre de la boîte : une, deux, trois', () => {
    assert.deepEqual(
      BENTO_ROWS.flat().map((tile) => tile.category),
      [...CATEGORY_ORDER],
    );
    assert.deepEqual(
      BENTO_ROWS.map((row) => row.map((tile) => tile.size).join()),
      ['xl', 'l,l', 's,s,s'],
    );
  });

  it('donne à ses cases les hauteurs de la maquette, plateau de 370 sur 402', () => {
    const heights = tileMinHeights(370);
    assert.equal(heights.xl, 175);
    assert.ok(Math.abs(heights.l - 143.33) < 0.01, `${heights.l}`);
    assert.ok(Math.abs(heights.s - 112.67) < 0.01, `${heights.s}`);
  });

  it('mesure 463 de haut sur 370 de large, comme à l’iPhone 17 Pro', () => {
    assert.ok(Math.abs(plateMinHeight(370) - 463) < 0.01, `${plateMinHeight(370)}`);
  });

  it('rapetisse en illustration quand la place manque, sans passer 0,72', () => {
    assert.equal(illustrationScale(463, 463), 1);
    assert.equal(illustrationScale(600, 463), 1);
    assert.ok(Math.abs(illustrationScale(332, plateMinHeight(343)) - 0.774) < 0.01);
    assert.equal(illustrationScale(100, 463), 0.72);
  });

  it('écrit ses libellés en 14/17, 12/14 dans une petite case', () => {
    assert.deepEqual(tilePromptType('xl', 1), { fontSize: 14, lineHeight: 17 });
    assert.deepEqual(tilePromptType('l', 1), { fontSize: 14, lineHeight: 17 });
    assert.deepEqual(tilePromptType('s', 1), { fontSize: 12, lineHeight: 14 });
  });

  it('arrête ses libellés à 130 %, avec leur hauteur de ligne', () => {
    const small = tilePromptType('s', 3);
    assert.ok(Math.abs(small.fontSize - 15.6) < 0.01, `${small.fontSize}`);
    assert.ok(Math.abs(small.lineHeight - 18.2) < 0.01, `${small.lineHeight}`);
  });

  it('garde « de » avec le mot qui le suit, et ne touche pas aux autres', () => {
    assert.equal(tilePrompt('Créateur de contenu'), 'Créateur de contenu');
    assert.equal(tilePrompt('Film'), 'Film');
  });

  it('se lit d’un seul libellé, les six catégories dans l’ordre', () => {
    assert.equal(
      emptyBentoLabel(),
      'Un bento vide, six cases : film, série, artiste, chanson, créateur de contenu, lieu',
    );
  });
});
