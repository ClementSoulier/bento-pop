import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  GRID_GEOMETRY,
  GRID_HEIGHT,
  GRID_SCALABLE_HEIGHT,
  gridBorderWidth,
  gridBoxHeight,
  gridScaleForHeight,
} from './geometry';

/** Cadre épaissi des posts à ruban dans le fil, `FeedPost.tsx`. */
const RIBBON_BORDER = 7;

describe('gridBoxHeight', () => {
  it('vaut 512 à l’échelle 1', () => {
    assert.equal(GRID_SCALABLE_HEIGHT, 502);
    assert.equal(gridBoxHeight(1), GRID_HEIGHT);
  });

  /**
   * Relevé au pixel sur la page publique d'un iPhone 17 Pro, qui passait
   * l'échelle 0,94 : 481,9 pt, une fois corrigé le rayon de coin qui en
   * faisait perdre 15 en haut comme en bas.
   */
  it('retrouve la hauteur mesurée au pixel à l’échelle 0,94', () => {
    assert.ok(Math.abs(gridBoxHeight(0.94) - 481.9) < 0.05, `${gridBoxHeight(0.94)}`);
  });

  /**
   * La spéc écrivait « 502 s + 10 », vrai de 0,9 à 1,1 seulement : le cadre
   * s'arrondit au point. À l'échelle du fil sur iPhone SE, il fait 4.
   */
  it('arrondit le cadre comme `BentoGrid`', () => {
    assert.equal(gridBorderWidth(0.94), 5);
    assert.equal(gridBorderWidth(311 / 361), 4);
    assert.equal(gridBorderWidth(0.5), 3);
    assert.equal(gridBorderWidth(0.1), 3, 'plancher à 3');
    assert.equal(gridBorderWidth(338 / 361, RIBBON_BORDER), 7);
    assert.ok(Math.abs(gridBoxHeight(311 / 361) - 440.47) < 0.01, `${gridBoxHeight(311 / 361)}`);
  });
});

describe('gridScaleForHeight', () => {
  /**
   * L'inverse doit être exact dans les deux sens : une échelle trop grande
   * glisse la boîte sous les boutons, une trop petite rend un bento plus petit
   * que la place ne l'impose. Balayé au quart de point, jusqu'à la tablette.
   */
  it('rend une échelle dont la boîte tient, et aucune plus grande ne tient', () => {
    for (const border of [GRID_GEOMETRY.BORDER, RIBBON_BORDER]) {
      for (let height = 0; height <= 1600; height += 0.25) {
        const scale = gridScaleForHeight(height, border);
        if (scale > 0) {
          assert.ok(
            gridBoxHeight(scale, border) <= height + 1e-9,
            `cadre ${border}, ${height} pt : la boîte en fait ${gridBoxHeight(scale, border)}`,
          );
        }
        assert.ok(
          gridBoxHeight(scale + 1e-6, border) > height,
          `cadre ${border}, ${height} pt : une échelle plus grande tenait encore`,
        );
      }
    }
  });

  it('est monotone : plus de hauteur, une échelle au moins aussi grande', () => {
    let previous = 0;
    for (let height = 0; height <= 1600; height += 0.5) {
      const scale = gridScaleForHeight(height);
      assert.ok(scale >= previous, `régression à ${height} pt`);
      previous = scale;
    }
  });

  it('rend 0 quand rien ne tient, sans valeur négative', () => {
    for (const height of [-100, 0, 3, 6]) {
      assert.equal(gridScaleForHeight(height), 0, `${height} pt`);
    }
  });

  /**
   * Le cas qui a disqualifié l'échelle calculée sur la seule hauteur : les
   * 352 pt qu'un iPhone SE laisse à la boîte. Elle y tiendrait à 0,689, cadre
   * de 3, soit 249 pt de large sur un écran de 375.
   */
  it('retrouve l’échelle de hauteur seule d’un iPhone SE', () => {
    const scale = gridScaleForHeight(352);
    assert.ok(Math.abs(scale - 346 / 502) < 1e-9, `${scale}`);
    assert.equal(gridBorderWidth(scale), 3);
    assert.ok(Math.abs(gridBoxHeight(scale) - 352) < 1e-9);
  });
});
