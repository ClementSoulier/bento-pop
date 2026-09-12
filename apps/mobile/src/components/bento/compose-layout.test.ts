import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CTA_GAP,
  MAX_SCALE,
  MIN_SCALE,
  NATIVE_GRID_H,
  composeAvailableHeight,
  composeBentoScale,
  composeCtaGap,
  type ComposeMetrics,
} from './compose-layout';

/** Appareils réels. La barre d'onglets inclut l'indicateur d'accueil. */
const SE: ComposeMetrics = { screenHeight: 667, insetTop: 20, tabBarHeight: 49 };
const IPHONE_17: ComposeMetrics = { screenHeight: 874, insetTop: 59, tabBarHeight: 84 };
const PRO_MAX: ComposeMetrics = { screenHeight: 956, insetTop: 62, tabBarHeight: 84 };

describe('composeBentoScale', () => {
  it('reste dans ses bornes sur les appareils réels', () => {
    for (const [name, m] of Object.entries({ SE, IPHONE_17, PRO_MAX })) {
      const scale = composeBentoScale(m);
      assert.ok(scale >= MIN_SCALE && scale <= MAX_SCALE, `${name} : ${scale}`);
    }
  });

  it('reste dans ses bornes même sur des métriques absurdes', () => {
    for (const h of [0, 100, 300, 2000]) {
      const scale = composeBentoScale({ screenHeight: h, insetTop: 59, tabBarHeight: 84 });
      assert.ok(scale >= MIN_SCALE && scale <= MAX_SCALE, `hauteur ${h} : ${scale}`);
      assert.ok(Number.isFinite(scale));
    }
  });

  it('est monotone : plus d\'écran, une grille au moins aussi grande', () => {
    let previous = 0;
    for (let h = 500; h <= 1200; h += 11) {
      const scale = composeBentoScale({ screenHeight: h, insetTop: 59, tabBarHeight: 84 });
      assert.ok(scale >= previous, `régression à ${h}`);
      previous = scale;
    }
  });
});

describe('écart entre la boîte et le bouton', () => {
  /**
   * Le défaut corrigé : `paddingBottom: tabBarHeight + 12` comptait la barre
   * d'onglets une seconde fois, alors que la zone de contenu l'exclut déjà.
   * Mesuré au pixel sur iPhone 17, bento plein : 0 pt entre la boîte et le
   * bouton, 93 pt de jaune mort sous le bouton.
   *
   * Ce test est la garantie qu'on ne peut plus retomber à zéro, sur aucun
   * appareil et quelle que soit la hauteur de barre d'onglets.
   */
  it('ne descend jamais sous CTA_GAP, sur tout appareil plausible', () => {
    for (let h = 560; h <= 1100; h += 7) {
      for (const inset of [20, 44, 47, 59, 62]) {
        for (const tab of [49, 56, 78, 84, 90]) {
          const gap = composeCtaGap({ screenHeight: h, insetTop: inset, tabBarHeight: tab });
          assert.ok(gap >= CTA_GAP, `${gap.toFixed(1)} pt à ${h}/${inset}/${tab}`);
        }
      }
    }
  });

  it('laisse respirer sur les appareils réels', () => {
    for (const [name, m] of Object.entries({ SE, IPHONE_17, PRO_MAX })) {
      const gap = composeCtaGap(m);
      assert.ok(gap >= CTA_GAP, `${name} : ${gap.toFixed(1)} pt`);
      // Un écart démesuré voudrait dire que la grille est trop rabougrie.
      assert.ok(gap < 200, `${name} : ${gap.toFixed(1)} pt, la boîte est trop petite`);
    }
  });

  /**
   * Le modèle doit coller au rendu, pas l'approcher de loin. La première
   * version se trompait de 38 pt parce que `CTA_BLOCK_H` valait 100 au lieu
   * des 66 mesurés : le calcul annonçait 28 pt là où l'écran en affichait
   * 66. Un modèle faux qui donne un résultat acceptable reste un modèle
   * faux, et il aurait menti au premier changement de gabarit.
   */
  it('vaut exactement CTA_GAP tant que la grille n\'est pas à sa taille native', () => {
    for (const [name, m] of Object.entries({ SE, IPHONE_17 })) {
      assert.ok(composeBentoScale(m) < MAX_SCALE, `${name} : grille déjà plafonnée`);
      assert.ok(
        Math.abs(composeCtaGap(m) - CTA_GAP) < 0.001,
        `${name} : ${composeCtaGap(m).toFixed(1)} pt au lieu de ${CTA_GAP}`,
      );
    }
  });

  it('dépasse CTA_GAP quand la grille plafonne', () => {
    assert.equal(composeBentoScale(PRO_MAX), MAX_SCALE);
    assert.ok(composeCtaGap(PRO_MAX) > CTA_GAP);
  });

  /**
   * Sur iPhone SE la grille prend tout ce qu'elle peut, donc le ressort se
   * réduit et c'est la marge du bouton qui tient l'écart. C'est exactement
   * le cas que le `marginTop` protège.
   */
  it('tient l\'écart sur le plus petit écran', () => {
    assert.ok(composeAvailableHeight(SE) < NATIVE_GRID_H, 'la grille devrait être réduite sur SE');
    assert.ok(composeCtaGap(SE) >= CTA_GAP);
  });
});
