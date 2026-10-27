import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bungeeTextWidth } from '@bento-pop/supabase-mobile/bento';
import { TAB_BAR_BASE_HEIGHT, TAB_BAR_BASE_INSET, TAB_LABEL_INSET, tabBarHeight, tabLabelScale } from './tab-bar';

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

describe('tabLabelScale', () => {
  const LABELS = ['Compose', 'La table', 'Trouver', 'Notifs', 'Profil'];

  it('ne change rien aux cinq libellés à la taille par défaut, dès 72 dp', () => {
    for (const label of LABELS) {
      for (const width of [72, 75, 80.4, 82.2]) {
        assert.equal(tabLabelScale(label, width, 9, 1), 1, `${label} sur ${width}`);
        assert.equal(tabLabelScale(label, width, 9, 1, 2.625), 1, `${label} sur ${width}, Android`);
      }
    }
  });

  it('fait tenir un libellé trop large, espacement compris', () => {
    const scale = tabLabelScale('Notifications', 72, 9, 1);
    assert.ok(scale < 1 && scale > 0.5, String(scale));
    const width = bungeeTextWidth('Notifications', 9 * scale, 1);
    assert.ok(width <= 72 - TAB_LABEL_INSET * 2 + 1e-9, String(width));
  });

  it('au plafond des contrôles, « La table » tient encore sur un petit Android', () => {
    const size = 9 * 1.2;
    const scale = tabLabelScale('La table', 72, size, 1, 2.625);
    const rendered = Math.ceil(size * scale * 2.625) / 2.625;
    assert.ok(bungeeTextWidth('La table', rendered, 1) <= 72 - TAB_LABEL_INSET * 2, String(scale));
  });

  it('lit une largeur absurde comme rien à réduire', () => {
    assert.equal(tabLabelScale('La table', 0, 9, 1), 1);
    assert.equal(tabLabelScale('La table', 75, 0, 1), 1);
  });
});
