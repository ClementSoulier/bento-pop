import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TILE_MAX_FONT_MULTIPLIER, fontScaleFor } from './font-scaling';
import { GRID_GEOMETRY } from './geometry';
import {
  EMPTY_TILE_MIN_INSET,
  TILE_MIN_CLEARANCE,
  emptyTileClearance,
  emptyTileConf,
  emptyTileLabelScale,
  tileConf,
  tileTextClearance,
  tileTextScale,
  type EmptyTileContent,
  type TileSize,
} from './tile-text';

/** Hauteur de chaque taille de case à l'échelle 1, telle que `BentoGrid` la donne. */
const HEIGHTS: Record<TileSize, number> = {
  lg: GRID_GEOMETRY.H_FILM,
  md: GRID_GEOMETRY.H_MID,
  sm: GRID_GEOMETRY.H_SM,
};
const SIZES: TileSize[] = ['sm', 'md', 'lg'];

/**
 * Les échelles de grille de l'app : le plancher du composer (0,65), l'écran de
 * mécanique (0,78), le fil et la page publique de 320 pt de large (0,709) au
 * plafond de 420 pt (1,163), et l'image de partage (2,5).
 */
const GRID_SCALES = [0.65, 0.67, 0.709, 0.78, 0.8199, 0.8615, 0.9036, 0.9624, 1, 1.1, 1.163, 2.5];

/** Tailles de police système : iOS de xSmall à la plus grande, Android jusqu'à 2. */
const FONT_SCALES = [0.823, 1, 1.118, 1.15, 1.235, 1.3, 1.353, 1.5, 1.786, 2, 2.643, 3.571];

describe('tileConf', () => {
  it('rend les paramètres que la case calculait elle-même', () => {
    assert.deepEqual(tileConf('sm', 0.8615), {
      title: 11,
      sub: 8,
      pad: 8,
      stamp: 7,
      letterSpacing: 0.5,
      initial: 59,
    });
    assert.deepEqual(tileConf('lg', 1), {
      title: 28,
      sub: 13,
      pad: 16,
      stamp: 9,
      letterSpacing: 1.2,
      initial: 140,
    });
  });

  it('plancher à 0,7 pour les tailles, et jamais d’étiquette sous 7 pt', () => {
    assert.deepEqual(tileConf('sm', 0.5), tileConf('sm', 0.7));
    assert.equal(tileConf('sm', 0.7).stamp, 7);
  });
});

describe('tileTextScale', () => {
  it('ne change rien à la taille de police par défaut, sur toute échelle de l’app', () => {
    for (const size of SIZES) {
      for (const scale of GRID_SCALES) {
        assert.equal(tileTextScale(HEIGHTS[size] * scale, size, scale, 1), 1, `${size} à ${scale}`);
      }
    }
  });

  it('ne laisse jamais l’étiquette toucher le titre, à toute taille et toute police', () => {
    for (const size of SIZES) {
      for (const scale of GRID_SCALES) {
        for (const fontScale of FONT_SCALES) {
          const height = HEIGHTS[size] * scale;
          const clearance = tileTextClearance(
            height,
            size,
            scale,
            tileTextScale(height, size, scale, fontScale),
          );
          assert.ok(
            clearance >= TILE_MIN_CLEARANCE - 1e-9,
            `${size} à ${scale}, police ${fontScale} : ${clearance.toFixed(2)} pt`,
          );
        }
      }
    }
  });

  it('ne dépasse jamais la taille système, ni le plafond des cases', () => {
    for (const size of SIZES) {
      for (const scale of GRID_SCALES) {
        for (const fontScale of FONT_SCALES) {
          const textScale = tileTextScale(HEIGHTS[size] * scale, size, scale, fontScale);
          assert.ok(textScale <= fontScaleFor(fontScale, TILE_MAX_FONT_MULTIPLIER) + 1e-12);
        }
      }
    }
  });

  it('va jusqu’au plafond dans les cases du fil, sur les iPhone et l’Android mesurés', () => {
    for (const scale of [0.8199, 0.8615, 0.9036, 0.9624]) {
      for (const size of SIZES) {
        assert.equal(
          tileTextScale(HEIGHTS[size] * scale, size, scale, 3.571),
          TILE_MAX_FONT_MULTIPLIER,
          `${size} à ${scale}`,
        );
      }
    }
  });

  /**
   * Le composer d'un iPhone SE est à 0,67 : au plafond, une petite case y
   * chevaucherait de 1 pt. Le texte y grossit donc un peu moins.
   */
  it('grossit moins là où la hauteur l’impose, et laisse juste la place minimale', () => {
    const scale = 0.67;
    const height = HEIGHTS.sm * scale;
    assert.ok(tileTextClearance(height, 'sm', scale, TILE_MAX_FONT_MULTIPLIER) < 0);
    const textScale = tileTextScale(height, 'sm', scale, 3.571);
    assert.ok(textScale > 1 && textScale < TILE_MAX_FONT_MULTIPLIER, String(textScale));
    assert.ok(
      Math.abs(tileTextClearance(height, 'sm', scale, textScale) - TILE_MIN_CLEARANCE) < 1e-9,
    );
  });

  /** La mesure qui a fixé le plafond : à 1,4, l'étiquette touchait le titre sur un SE. */
  it('chevaucherait au plafond de 1,4 dans une petite case du fil sur un iPhone SE', () => {
    assert.ok(tileTextClearance(HEIGHTS.sm * 0.8615, 'sm', 0.8615, 1.4) < TILE_MIN_CLEARANCE);
  });
});

/** Le composer avec son cercle, la consultation sans ; un libellé d'une ligne ou de deux. */
const EMPTY_CONTENTS: EmptyTileContent[] = [1, 2].flatMap((lines) =>
  [true, false].map((withCircle) => ({ lines, withCircle })),
);

describe('emptyTileConf', () => {
  it('rend les paramètres que la case vide calculait elle-même', () => {
    assert.deepEqual(emptyTileConf(1), { circle: 36, plus: 20, label: 10, gap: 6 });
    const small = emptyTileConf(0.7);
    assert.deepEqual(
      { ...small, gap: Number(small.gap.toFixed(6)) },
      {
        circle: 25,
        plus: 14,
        label: 8,
        gap: 4.2,
      },
    );
  });

  it('plancher à 0,7, et jamais de libellé sous 8 pt', () => {
    assert.deepEqual(emptyTileConf(0.5), emptyTileConf(0.7));
    assert.equal(emptyTileConf(0.7).label, 8);
  });
});

describe('emptyTileLabelScale', () => {
  it('ne change rien à la taille de police par défaut, sur toute échelle de l’app', () => {
    for (const size of SIZES) {
      for (const scale of GRID_SCALES) {
        for (const content of EMPTY_CONTENTS) {
          assert.equal(
            emptyTileLabelScale(HEIGHTS[size] * scale, scale, 1, content),
            1,
            `${size} à ${scale}, ${JSON.stringify(content)}`,
          );
        }
      }
    }
  });

  it('ne laisse jamais le contenu approcher le pointillé, à toute taille et toute police', () => {
    for (const size of SIZES) {
      for (const scale of GRID_SCALES) {
        for (const content of EMPTY_CONTENTS) {
          for (const fontScale of FONT_SCALES) {
            const height = HEIGHTS[size] * scale;
            const clearance = emptyTileClearance(
              height,
              scale,
              emptyTileLabelScale(height, scale, fontScale, content),
              content,
            );
            assert.ok(
              clearance >= EMPTY_TILE_MIN_INSET - 1e-9,
              `${size} à ${scale}, police ${fontScale}, ${JSON.stringify(content)} : ${clearance.toFixed(2)} pt`,
            );
          }
        }
      }
    }
  });

  it('ne dépasse jamais la taille système, ni le plafond des cases', () => {
    for (const size of SIZES) {
      for (const scale of GRID_SCALES) {
        for (const content of EMPTY_CONTENTS) {
          for (const fontScale of FONT_SCALES) {
            const labelScale = emptyTileLabelScale(
              HEIGHTS[size] * scale,
              scale,
              fontScale,
              content,
            );
            assert.ok(labelScale <= fontScaleFor(fontScale, TILE_MAX_FONT_MULTIPLIER) + 1e-12);
          }
        }
      }
    }
  });

  /**
   * La mesure de départ : le composer de l'émulateur Android à 360 dp, échelle
   * 0,82, taille de police 2,0. Trois lignes n'y laissent pas la place
   * minimale, deux lignes vont jusqu'au plafond.
   */
  it('va jusqu’au plafond sur deux lignes là où trois ne tenaient pas', () => {
    const scale = 0.82;
    const height = HEIGHTS.sm * scale;
    const threeLines = { lines: 3, withCircle: true };
    const twoLines = { lines: 2, withCircle: true };
    assert.ok(
      emptyTileClearance(height, scale, TILE_MAX_FONT_MULTIPLIER, threeLines) <
        EMPTY_TILE_MIN_INSET,
    );
    assert.equal(emptyTileLabelScale(height, scale, 2, twoLines), TILE_MAX_FONT_MULTIPLIER);
  });

  /** Le plancher du composer : deux lignes au plafond y approcheraient le pointillé. */
  it('grossit moins là où la hauteur l’impose, et laisse juste la place minimale', () => {
    const scale = 0.65;
    const height = HEIGHTS.sm * scale;
    const content = { lines: 2, withCircle: true };
    assert.ok(
      emptyTileClearance(height, scale, TILE_MAX_FONT_MULTIPLIER, content) < EMPTY_TILE_MIN_INSET,
    );
    const labelScale = emptyTileLabelScale(height, scale, 3.571, content);
    assert.ok(labelScale > 1 && labelScale < TILE_MAX_FONT_MULTIPLIER, String(labelScale));
    assert.ok(
      Math.abs(emptyTileClearance(height, scale, labelScale, content) - EMPTY_TILE_MIN_INSET) <
        1e-9,
    );
  });

  /** Mesuré sur le composer d'un iPhone SE à la taille par défaut : 5,6 pt. */
  it('retrouve la place mesurée dans le composer d’un iPhone SE', () => {
    const clearance = emptyTileClearance(65.44, 65.44 / HEIGHTS.sm, 1, {
      lines: 2,
      withCircle: true,
    });
    assert.ok(Math.abs(clearance - 5.6) < 0.1, clearance.toFixed(2));
  });
});
