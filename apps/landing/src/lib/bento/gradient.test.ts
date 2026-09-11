import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PALETTES, type PaletteKey } from '@bento-pop/supabase-mobile/bento';
import { cssAngleOf, paletteGradient } from './gradient';

describe('cssAngleOf', () => {
  /**
   * Les palettes sont décrites avec les conventions d'`expo-linear-gradient`
   * (`y` croissant vers le bas) ; CSS compte les angles depuis le haut, dans
   * le sens horaire. Ces quatre repères verrouillent la conversion.
   */
  it('convertit les directions cardinales', () => {
    assert.equal(cssAngleOf({ x: 0, y: 0 }, { x: 0, y: 1 }), 180, 'vers le bas');
    assert.equal(cssAngleOf({ x: 0, y: 0 }, { x: 1, y: 0 }), 90, 'vers la droite');
    assert.equal(cssAngleOf({ x: 0, y: 1 }, { x: 0, y: 0 }), 0, 'vers le haut');
    assert.equal(cssAngleOf({ x: 1, y: 0 }, { x: 0, y: 0 }), 270, 'vers la gauche');
  });

  it('convertit les diagonales', () => {
    assert.equal(cssAngleOf({ x: 0, y: 0 }, { x: 1, y: 1 }), 135);
    assert.equal(cssAngleOf({ x: 0.2, y: 0 }, { x: 0.8, y: 1 }), 149);
  });

  it('renvoie un dégradé vertical plutôt qu’un NaN sur un vecteur nul', () => {
    assert.equal(cssAngleOf({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }), 180);
  });

  it('reste dans [0, 360[', () => {
    for (const key of Object.keys(PALETTES) as PaletteKey[]) {
      const angle = cssAngleOf(PALETTES[key].start, PALETTES[key].end);
      assert.ok(angle >= 0 && angle < 360, `${key} : angle ${angle}`);
      assert.ok(Number.isInteger(angle), `${key} : angle non entier`);
    }
  });
});

describe('paletteGradient', () => {
  it('produit une règle CSS complète', () => {
    assert.equal(
      paletteGradient('squeezie'),
      'linear-gradient(149deg, #4b3d8f, #2a1f5c)',
    );
  });

  it('produit une règle valide pour chaque palette', () => {
    for (const key of Object.keys(PALETTES) as PaletteKey[]) {
      const css = paletteGradient(key);
      assert.match(css, /^linear-gradient\(\d{1,3}deg(, #[0-9a-f]{6})+\)$/, `${key} : ${css}`);
    }
  });
});
