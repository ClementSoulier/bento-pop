import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TAB_BAR_BASE_HEIGHT, TAB_BAR_BASE_INSET, tabBarHeight } from './tab-bar';

describe('tabBarHeight', () => {
  it('ne change rien là où la barre tenait', () => {
    // iPhone SE, iPhone à indicateur d'accueil, Android en gestes.
    assert.equal(tabBarHeight(0, TAB_BAR_BASE_INSET.ios), TAB_BAR_BASE_HEIGHT);
    assert.equal(tabBarHeight(34, TAB_BAR_BASE_INSET.ios), TAB_BAR_BASE_HEIGHT);
    assert.equal(tabBarHeight(24, TAB_BAR_BASE_INSET.android), TAB_BAR_BASE_HEIGHT);
  });

  it('rend la même zone utile en navigation à trois boutons', () => {
    // 48 dp de marge au lieu de 24 : la barre grandit d'autant, 108 de haut.
    assert.equal(tabBarHeight(48, TAB_BAR_BASE_INSET.android), 108);
    assert.equal(
      tabBarHeight(48, TAB_BAR_BASE_INSET.android) - 48,
      TAB_BAR_BASE_HEIGHT - TAB_BAR_BASE_INSET.android,
    );
  });

  it('lit une marge absurde comme nulle', () => {
    for (const inset of [Number.NaN, Number.POSITIVE_INFINITY, -10]) {
      assert.equal(tabBarHeight(inset, TAB_BAR_BASE_INSET.ios), TAB_BAR_BASE_HEIGHT, String(inset));
    }
  });
});
