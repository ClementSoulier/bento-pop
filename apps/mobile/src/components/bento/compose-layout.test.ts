import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CTA_BLOCK_H,
  CTA_GAP,
  CTA_GAP_MIN,
  HEADER_H,
  MAX_SCALE,
  MIN_SCALE,
  NATIVE_GRID_H,
  PSEUDO_LINE_H,
  STAMP_LABEL_LINE_H,
  STATUS_LINE_H,
  composeAvailableHeight,
  composeBentoScale,
  composeCtaBlockHeight,
  composeCtaGap,
  composeHeaderHeight,
  type ComposeMetrics,
} from './compose-layout';
import { CONTROL_MAX_FONT_MULTIPLIER, TITLE_MAX_FONT_MULTIPLIER } from './font-scaling';

/**
 * Appareils réels. La barre d'onglets inclut l'indicateur d'accueil, et mesure
 * 84 pt partout où sa hauteur est fixée, SE compris : relevé dans l'arbre
 * d'accessibilité au chantier 11, là où ce test supposait 49.
 */
const SE: ComposeMetrics = { screenHeight: 667, insetTop: 20, tabBarHeight: 84, fontScale: 1 };
const IPHONE_17: ComposeMetrics = { screenHeight: 874, insetTop: 59, tabBarHeight: 84, fontScale: 1 };
const PRO_MAX: ComposeMetrics = { screenHeight: 956, insetTop: 62, tabBarHeight: 84, fontScale: 1 };

/** Tailles de police système relevées : iOS xLarge, xxLarge, xxxLarge, AX5 ; Android 1,3 et 2,0. */
const FONT_SCALES = [0.823, 1, 1.118, 1.235, 1.3, 1.353, 2, 3.571];

describe('composeBentoScale', () => {
  it('reste dans ses bornes sur les appareils réels', () => {
    for (const [name, m] of Object.entries({ SE, IPHONE_17, PRO_MAX })) {
      const scale = composeBentoScale(m);
      assert.ok(scale >= MIN_SCALE && scale <= MAX_SCALE, `${name} : ${scale}`);
    }
  });

  it('reste dans ses bornes même sur des métriques absurdes', () => {
    for (const h of [0, 100, 300, 2000]) {
      const scale = composeBentoScale({ screenHeight: h, insetTop: 59, tabBarHeight: 84, fontScale: 1 });
      assert.ok(scale >= MIN_SCALE && scale <= MAX_SCALE, `hauteur ${h} : ${scale}`);
      assert.ok(Number.isFinite(scale));
    }
  });

  it('est monotone : plus d\'écran, une grille au moins aussi grande', () => {
    let previous = 0;
    for (let h = 500; h <= 1200; h += 11) {
      const scale = composeBentoScale({ screenHeight: h, insetTop: 59, tabBarHeight: 84, fontScale: 1 });
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
   * appareil et quelle que soit la hauteur de barre d'onglets : l'écart visé
   * partout où la grille n'est pas à son plancher, l'écart minimal ailleurs.
   */
  it('ne descend jamais sous l’écart minimal, et vise CTA_GAP hors plancher', () => {
    for (let h = 560; h <= 1100; h += 7) {
      for (const inset of [20, 44, 47, 59, 62]) {
        for (const tab of [49, 56, 78, 84, 90]) {
          const m = { screenHeight: h, insetTop: inset, tabBarHeight: tab, fontScale: 1 };
          const gap = composeCtaGap(m);
          assert.ok(gap >= CTA_GAP_MIN, `${gap.toFixed(1)} pt à ${h}/${inset}/${tab}`);
          if (composeBentoScale(m) > MIN_SCALE) {
            assert.ok(gap >= CTA_GAP - 1e-9, `${gap.toFixed(1)} pt à ${h}/${inset}/${tab}`);
          }
        }
      }
    }
  });

  it('laisse respirer sur les appareils réels', () => {
    for (const [name, m] of Object.entries({ SE, IPHONE_17, PRO_MAX })) {
      const gap = composeCtaGap(m);
      assert.ok(gap >= CTA_GAP_MIN, `${name} : ${gap.toFixed(1)} pt`);
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
  it('vaut exactement CTA_GAP tant que la grille n\'est ni plafonnée ni au plancher', () => {
    for (const [name, m] of Object.entries({ IPHONE_17 })) {
      assert.ok(composeBentoScale(m) < MAX_SCALE, `${name} : grille déjà plafonnée`);
      assert.ok(composeBentoScale(m) > MIN_SCALE, `${name} : grille au plancher`);
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
   * Sur iPhone SE la grille est à son plancher dès la taille par défaut, donc le
   * ressort se réduit à rien et c'est la marge du bouton qui tient l'écart :
   * l'écart minimal, et non l'écart visé, qui poussait le bouton sous la barre
   * d'onglets dès la taille xLarge (chantier 11).
   */
  it('tient l\'écart minimal sur le plus petit écran', () => {
    assert.ok(composeAvailableHeight(SE) < NATIVE_GRID_H, 'la grille devrait être réduite sur SE');
    assert.equal(composeBentoScale(SE), MIN_SCALE);
    const gap = composeCtaGap(SE);
    assert.ok(gap >= CTA_GAP_MIN && gap < CTA_GAP, `${gap.toFixed(1)} pt`);
  });
});

describe('police système', () => {
  it('pose des lignes égales à celles qu’iOS rend sans elles', () => {
    // Arbre d'accessibilité de l'iPhone 17 Pro : 13,33, 14,67 et un bouton de 54.
    assert.equal(PSEUDO_LINE_H.toFixed(2), '13.33');
    assert.equal(STATUS_LINE_H.toFixed(2), '14.67');
    assert.equal(STAMP_LABEL_LINE_H, 20);
  });

  /**
   * La taille par défaut est celle que tout le monde voit : le budget y reste
   * exactement celui d'avant le chantier 11, donc la boîte ne bouge d'aucun
   * point sur aucun téléphone.
   */
  it('laisse le budget inchangé à la taille par défaut', () => {
    assert.equal(composeHeaderHeight(1), HEADER_H);
    assert.equal(composeCtaBlockHeight(1), CTA_BLOCK_H);
    // 874 − 62 − 46 − 88 − 84 − 66 − 56 = 472, sur 512.
    assert.equal(
      composeBentoScale({ screenHeight: 874, insetTop: 62, tabBarHeight: 84, fontScale: 1 }),
      472 / 512,
    );
  });

  it('fait grossir en-tête et bouton avec la police, jusqu’à leurs plafonds', () => {
    let previousHeader = 0;
    let previousCta = 0;
    for (const fontScale of FONT_SCALES) {
      const header = composeHeaderHeight(fontScale);
      const cta = composeCtaBlockHeight(fontScale);
      assert.ok(header >= previousHeader, `en-tête à ${fontScale}`);
      assert.ok(cta >= previousCta, `bouton à ${fontScale}`);
      previousHeader = header;
      previousCta = cta;
    }
    const capped = Math.max(CONTROL_MAX_FONT_MULTIPLIER, TITLE_MAX_FONT_MULTIPLIER);
    assert.equal(composeHeaderHeight(3.571), composeHeaderHeight(capped));
    assert.equal(composeCtaBlockHeight(3.571), composeCtaBlockHeight(capped));
    assert.equal(composeCtaBlockHeight(3.571), CTA_BLOCK_H + STAMP_LABEL_LINE_H * 0.2);
  });

  it('fait rétrécir la grille quand la police grossit, jamais sous le plancher', () => {
    for (const device of [SE, IPHONE_17, PRO_MAX]) {
      let previous = Number.POSITIVE_INFINITY;
      for (const fontScale of FONT_SCALES) {
        const scale = composeBentoScale({ ...device, fontScale });
        assert.ok(scale <= previous + 1e-9, `${device.screenHeight} pt à ${fontScale}`);
        assert.ok(scale >= MIN_SCALE);
        previous = scale;
      }
    }
  });

  /**
   * Là où le plancher mord, ce qui ne tient plus se rattrape en faisant défiler
   * l'écran : le bouton garde son écart, il ne passe plus sous la barre.
   */
  it('garde l’écart du bouton à toute police, quitte à défiler', () => {
    for (const device of [SE, IPHONE_17, PRO_MAX]) {
      for (const fontScale of FONT_SCALES) {
        assert.ok(composeCtaGap({ ...device, fontScale }) >= CTA_GAP_MIN);
      }
    }
  });
});
