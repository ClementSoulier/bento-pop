import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { feedBoxWidth, feedScale, feedSideInset } from '@/components/feed/layout';
import { GRID_WIDTH, gridBoxHeight, gridScaleForHeight } from './geometry';
import {
  BUTTON_MAX_FONT_MULTIPLIER,
  CONTENT_MAX_FONT_MULTIPLIER,
  MIN_SCALE,
  TOP_BAR_H,
  publicBentoScale,
  publicBoxAvailableHeight,
  publicCtaBlockHeight,
  publicHeaderHeight,
  publicScrollOverflow,
  publicSideInset,
  type PublicLayoutMetrics,
} from './public-layout';

/** Appareils mesurés au simulateur le 14 septembre 2026, police par défaut. */
const DEVICES = {
  'iPhone 17 Pro': { width: 402, height: 874, insetTop: 62, insetBottom: 34, fontScale: 1 },
  'iPhone 17e': { width: 390, height: 844, insetTop: 47, insetBottom: 34, fontScale: 1 },
  'iPhone SE': { width: 375, height: 667, insetTop: 20, insetBottom: 0, fontScale: 1 },
} satisfies Record<string, PublicLayoutMetrics>;

const PRO = DEVICES['iPhone 17 Pro'];
const SE = DEVICES['iPhone SE'];

/**
 * Multiplicateurs de React Native pour les tailles de police iOS, repris de
 * `RCTAccessibilityManager.mm`. Seules les quatre dernières sont des tailles
 * d'accessibilité : xLarge à xxxLarge sont des réglages ordinaires.
 */
const FONT_SCALES = [0.823, 1, 1.118, 1.235, 1.353, 1.786, 2.643, 3.571];
const LARGEST_FONT = 3.571;

/**
 * Toutes les fenêtres plausibles : 200 largeurs du téléphone étroit à la
 * tablette, les hauteurs courantes, les marges système d'iPhone et
 * d'Android, et chaque taille de police.
 */
function* plausibleMetrics(): Generator<PublicLayoutMetrics> {
  for (let i = 0; i < 200; i += 1) {
    const width = 320 + Math.round((i * (1024 - 320)) / 199);
    for (const height of [480, 568, 640, 667, 736, 800, 812, 844, 874, 915, 956, 1024, 1366]) {
      for (const [insetTop, insetBottom] of [
        [0, 0],
        [20, 0],
        [24, 48],
        [47, 34],
        [62, 34],
      ] as const) {
        for (const fontScale of FONT_SCALES) {
          yield { width, height, insetTop, insetBottom, fontScale };
        }
      }
    }
  }
}

describe('le modèle colle au rendu mesuré', () => {
  /**
   * Relevé par arbre d'accessibilité sur l'écran d'avant le chantier, dont
   * l'en-tête faisait 12 pt de plus : haut de la boîte à 261,9 sur un 17 Pro,
   * 247 sur un 17e, 219,9 sur un SE. Une constante qui dériverait du rendu
   * fait tomber ce test avant la recette.
   */
  it('retrouve le haut de la boîte mesuré sur les trois appareils', () => {
    const HEADER_TRIM = 12;
    const measured: Record<keyof typeof DEVICES, number> = {
      'iPhone 17 Pro': 261.9,
      'iPhone 17e': 247,
      'iPhone SE': 219.9,
    };
    for (const [name, m] of Object.entries(DEVICES) as [
      keyof typeof DEVICES,
      PublicLayoutMetrics,
    ][]) {
      const top = m.insetTop + TOP_BAR_H + publicHeaderHeight(1) + HEADER_TRIM;
      assert.ok(
        Math.abs(top - measured[name]) <= 0.2,
        `${name} : ${top} contre ${measured[name]} mesurés`,
      );
    }
  });

  /**
   * Relevé au pixel sur la capture d'un 17 Pro, colonne x = 150 pt, loin de
   * tout coin arrondi : bord bas de la boîte à 743,7 pt, haut du premier
   * bouton à 756,7. L'écran passait alors l'échelle 0,94.
   */
  it('retrouve le bas de la boîte et le haut des boutons mesurés au pixel', () => {
    const boxBottom = PRO.insetTop + TOP_BAR_H + publicHeaderHeight(1) + 12 + gridBoxHeight(0.94);
    assert.ok(Math.abs(boxBottom - 743.7) <= 0.5, `bas de la boîte : ${boxBottom}`);

    const CTA_BLOCK_PADDING_TOP = 16;
    const buttonTop =
      PRO.height - PRO.insetBottom - publicCtaBlockHeight(1) + CTA_BLOCK_PADDING_TOP;
    assert.ok(Math.abs(buttonTop - 756.7) <= 0.5, `haut des boutons : ${buttonTop}`);
  });
});

describe('publicBentoScale, sur les appareils mesurés', () => {
  it('rend la boîte du fil sur un iPhone 17 Pro, sans défilement', () => {
    assert.equal(publicBentoScale(PRO), feedScale(PRO.width));
    assert.equal(publicScrollOverflow(PRO), 0);
  });

  it('rend la boîte du fil sur un iPhone 17e, sans défilement', () => {
    const m = DEVICES['iPhone 17e'];
    assert.equal(publicBentoScale(m), feedScale(m.width));
    assert.equal(publicScrollOverflow(m), 0);
  });

  /**
   * La hauteur seule y donnerait 0,689, une boîte de 249 pt de large : c'est
   * ce qui a écarté l'échelle dynamique du composer. Le plancher l'emporte, et
   * c'est exactement la boîte du fil, au prix d'un défilement.
   */
  it('pose le plancher sur un iPhone SE, qui est la boîte du fil, et défile', () => {
    assert.ok(gridScaleForHeight(publicBoxAvailableHeight(SE)) < MIN_SCALE);
    assert.equal(MIN_SCALE, feedScale(SE.width));
    assert.equal(publicBentoScale(SE), MIN_SCALE);

    const overflow = publicScrollOverflow(SE);
    assert.ok(overflow > 80 && overflow < 95, `${overflow.toFixed(1)} pt de défilement`);
  });

  it('donne à la boîte la largeur du fil sur les trois appareils', () => {
    for (const [name, m] of Object.entries(DEVICES)) {
      const width = GRID_WIDTH * publicBentoScale(m);
      assert.ok(Math.abs(width - feedBoxWidth(m.width)) < 1e-9, `${name} : ${width} pt`);
    }
  });
});

describe('publicBentoScale, sur toute fenêtre plausible', () => {
  it('ne dépasse jamais l’échelle du fil', () => {
    for (const m of plausibleMetrics()) {
      assert.ok(publicBentoScale(m) <= feedScale(m.width), JSON.stringify(m));
    }
  });

  /**
   * La spéc demandait « jamais sous `MIN_SCALE` », ce qui contredit sa propre
   * formule : sous 374,5 pt de large, le fil lui-même descend sous le
   * plancher, et la largeur l'emporte. Ce qui tient partout, c'est de ne
   * jamais descendre sous le plus petit des deux.
   */
  it('ne descend jamais sous le plus petit du plancher et de l’échelle du fil', () => {
    for (const m of plausibleMetrics()) {
      const floor = Math.min(MIN_SCALE, feedScale(m.width));
      assert.ok(publicBentoScale(m) >= floor, JSON.stringify(m));
    }
  });

  /**
   * L'invariant du chantier. Tant que la hauteur permet d'atteindre le
   * plancher, la boîte tient au-dessus des boutons, au point près et avec le
   * vrai cadre arrondi. Quand elle ne le permet pas, la boîte dépasse, et tout
   * ce qui dépasse se rattrape en défilant.
   */
  it('ne laisse jamais la boîte sous les boutons sans que la page défile', () => {
    for (const m of plausibleMetrics()) {
      const available = publicBoxAvailableHeight(m);
      const scale = publicBentoScale(m);
      const byHeight = gridScaleForHeight(available);
      if (byHeight >= Math.min(MIN_SCALE, feedScale(m.width))) {
        // Même tolérance des deux côtés : quand la boîte remplit exactement la
        // place, le calcul flottant laisse un dépassement de l'ordre de 1e-13.
        assert.ok(gridBoxHeight(scale) <= available + 1e-9, `recouverte : ${JSON.stringify(m)}`);
        assert.ok(publicScrollOverflow(m) < 1e-9, `défile : ${JSON.stringify(m)}`);
      } else {
        assert.ok(publicScrollOverflow(m) > 0, `ne défile pas : ${JSON.stringify(m)}`);
      }
    }
  });

  /**
   * `useWindowDimensions` peut rendre 0 sur la première frame de certaines
   * plateformes, et une valeur de police absurde ne doit rien casser non plus.
   */
  it('reste finie et positive sur une fenêtre absurde', () => {
    for (const width of [0, -10, 100, 402]) {
      for (const height of [0, -50, 10, 874]) {
        for (const fontScale of [0, -1, Number.NaN, 1, 100]) {
          const scale = publicBentoScale({
            width,
            height,
            insetTop: 62,
            insetBottom: 34,
            fontScale,
          });
          assert.ok(
            Number.isFinite(scale) && scale > 0,
            `${width}×${height}, police ${fontScale} : ${scale}`,
          );
        }
      }
    }
  });

  it('rend le plancher tant que la fenêtre n’a pas de hauteur', () => {
    assert.equal(publicBentoScale({ ...PRO, height: 0 }), MIN_SCALE);
  });
});

describe('la taille de police système', () => {
  /**
   * Avec un en-tête constant, une police agrandie faisait grossir l'en-tête
   * sans que l'échelle le sache, et la boîte passait sous les boutons. Elle
   * doit rétrécir, et jamais grandir quand la police grossit.
   */
  it('ne fait jamais grandir la boîte quand la police grossit', () => {
    for (const [name, m] of Object.entries(DEVICES)) {
      let previous = Number.POSITIVE_INFINITY;
      for (const fontScale of FONT_SCALES) {
        const scale = publicBentoScale({ ...m, fontScale });
        assert.ok(scale <= previous, `${name}, police ${fontScale} : ${scale} après ${previous}`);
        previous = scale;
      }
    }
  });

  it('rétrécit la boîte d’un 17 Pro à la plus grande taille, sans défilement', () => {
    const m = { ...PRO, fontScale: LARGEST_FONT };
    assert.ok(publicBentoScale(m) < feedScale(PRO.width), 'la boîte aurait dû rétrécir');
    assert.equal(publicScrollOverflow(m), 0);
  });

  it('plafonne la croissance aux valeurs que l’écran pose', () => {
    assert.ok(publicHeaderHeight(1.235) > publicHeaderHeight(1));
    assert.equal(publicHeaderHeight(LARGEST_FONT), publicHeaderHeight(CONTENT_MAX_FONT_MULTIPLIER));
    assert.equal(
      publicCtaBlockHeight(LARGEST_FONT),
      publicCtaBlockHeight(BUTTON_MAX_FONT_MULTIPLIER),
    );
  });

  it('rend les hauteurs mesurées à la taille par défaut', () => {
    assert.equal(publicHeaderHeight(1), 144);
    assert.equal(publicCtaBlockHeight(1), 99);
  });
});

describe('publicSideInset', () => {
  it('vaut la marge du fil sur les trois appareils', () => {
    for (const [name, m] of Object.entries(DEVICES)) {
      const inset = publicSideInset(m.width, publicBentoScale(m));
      assert.ok(Math.abs(inset - feedSideInset(m.width)) < 1e-9, `${name} : ${inset}`);
    }
  });

  it('reconstitue exactement la largeur de la fenêtre avec la boîte', () => {
    for (const m of plausibleMetrics()) {
      const scale = publicBentoScale(m);
      const total = publicSideInset(m.width, scale) * 2 + GRID_WIDTH * scale;
      assert.ok(Math.abs(total - m.width) < 1e-9, `${JSON.stringify(m)} : ${total}`);
    }
  });

  it('ne devient jamais négative', () => {
    for (const width of [0, -100, 50, 200]) {
      assert.ok(publicSideInset(width, 1) >= 0, `${width}`);
    }
  });
});
