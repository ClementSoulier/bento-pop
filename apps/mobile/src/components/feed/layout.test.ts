import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GRID_GEOMETRY, GRID_HEIGHT, GRID_WIDTH } from '@/components/bento/geometry';
import {
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  H_PADDING,
  HEADER_GAP,
  MAX_BOX_WIDTH,
  MIN_BOX_WIDTH,
  POST_GAP,
  feedBoxWidth,
  feedScale,
} from './layout';

/** Largeurs de fenêtre réelles, en points. */
const SE = 375;
const IPHONE_15 = 393;
const PRO_MAX = 430;
const TABLETTE = 834;

describe('géométrie de la boîte bento', () => {
  /**
   * 512 est recopié en dur dans le composer (`NATIVE_GRID_H`), côté landing
   * (`DESIGN_HEIGHT`) et dans le dimensionnement de l'image de partage. Aucun
   * de ces trois endroits ne se parle. Changer une hauteur de rangée sans ce
   * test les désynchroniserait en silence.
   */
  it('somme à 512, la hauteur sur laquelle tout le reste est calé', () => {
    assert.equal(GRID_HEIGHT, 512);
    assert.equal(
      GRID_HEIGHT,
      GRID_GEOMETRY.PAD * 2 +
        GRID_GEOMETRY.BORDER * 2 +
        GRID_GEOMETRY.H_FILM +
        GRID_GEOMETRY.GAP +
        GRID_GEOMETRY.H_MID +
        GRID_GEOMETRY.GAP +
        GRID_GEOMETRY.H_SM,
    );
  });

  /**
   * La marge latérale était à 16, ce qui faisait tomber la boîte pile à
   * l'échelle 1 sur un iPhone 15 (361 = 393 - 32). Coïncidence élégante, mais
   * les posts touchaient les bords. Elle est passée à 24, et la boîte est
   * donc désormais légèrement réduite sur un téléphone plutôt qu'à taille
   * exacte : c'est voulu, et ce test le dit pour qu'on ne « rétablisse » pas
   * l'ancienne valeur en croyant corriger une dérive.
   */
  it('laisse la boîte respirer plutôt que de la caler sur la largeur exacte', () => {
    assert.equal(GRID_WIDTH, 361);
    assert.equal(H_PADDING, 24);
    assert.ok(
      IPHONE_15 - H_PADDING * 2 < GRID_WIDTH,
      'la boîte devrait être réduite, pas pleine largeur',
    );
  });

  it('est reprise telle quelle par le fil', () => {
    assert.equal(DESIGN_WIDTH, GRID_WIDTH);
    assert.equal(DESIGN_HEIGHT, GRID_HEIGHT);
  });
});

describe('feedBoxWidth', () => {
  it('remplit la largeur utile sur un téléphone', () => {
    assert.equal(feedBoxWidth(SE), SE - H_PADDING * 2);
    assert.equal(feedBoxWidth(IPHONE_15), IPHONE_15 - H_PADDING * 2);
    assert.equal(feedBoxWidth(PRO_MAX), PRO_MAX - H_PADDING * 2);
  });

  it('plafonne sur tablette', () => {
    assert.equal(feedBoxWidth(TABLETTE), MAX_BOX_WIDTH);
    assert.equal(feedBoxWidth(2000), MAX_BOX_WIDTH);
  });

  /**
   * `useWindowDimensions` peut rendre 0 sur la première frame. Sans plancher,
   * la largeur passerait à -32 et l'échelle deviendrait négative.
   */
  it('ne descend jamais sous le plancher, même sur une largeur absurde', () => {
    for (const width of [0, 1, 32, 100, -100]) {
      assert.ok(feedBoxWidth(width) >= MIN_BOX_WIDTH, `plancher franchi pour ${width}`);
    }
  });

  it('est monotone', () => {
    let previous = 0;
    for (let width = 100; width <= 1200; width += 7) {
      const value = feedBoxWidth(width);
      assert.ok(value >= previous, `régression de largeur à ${width}`);
      previous = value;
    }
  });
});

describe('feedScale', () => {
  it('reste juste sous 1 sur un iPhone 15', () => {
    // 345 / 361. La boîte est légèrement réduite, ce qui est le prix des
    // 24 pt de marge.
    assert.ok(feedScale(IPHONE_15) > 0.95 && feedScale(IPHONE_15) < 1);
  });

  it('reste au-dessus du plancher typographique de la tuile sur les vrais écrans', () => {
    // `Tile` plafonne son échelle typographique à 0,7 : en dessous, les
    // tampons deviennent illisibles. Aucun téléphone supporté ne doit
    // approcher cette borne.
    for (const width of [SE, IPHONE_15, PRO_MAX]) {
      const scale = feedScale(width);
      assert.ok(scale > 0.9, `échelle trop basse sur ${width} pt : ${scale}`);
      // Le plus grand téléphone (Pro Max, 430 pt) monte à 1,10 : la boîte y
      // est un peu plus grande que sur le design, pas d'un autre ordre.
      assert.ok(scale < 1.15, `échelle trop haute sur ${width} pt : ${scale}`);
    }
  });

  it('reste raisonnable sur tablette', () => {
    const scale = feedScale(TABLETTE);
    assert.ok(scale > 1.1 && scale < 1.2, `échelle tablette : ${scale}`);
  });

  it('est toujours strictement positive', () => {
    for (const width of [0, -50, 10, 320, 5000]) {
      assert.ok(feedScale(width) > 0, `échelle nulle ou négative pour ${width}`);
    }
  });

  /**
   * La hauteur du post doit laisser voir le début du suivant sur un écran
   * courant : c'est le signal qui dit qu'on peut défiler. Sur un iPhone 15,
   * 852 pt d'écran moins l'encoche et la barre d'onglets laissent 709 pt.
   */
  it('laisse apparaître le post suivant sur un iPhone 15', () => {
    const HEADER = 64;
    const GAP = HEADER_GAP;
    const MARGIN = POST_GAP;
    const USABLE = 709;
    const post = HEADER + GAP + DESIGN_HEIGHT * feedScale(IPHONE_15) + MARGIN;
    assert.ok(post < USABLE, `le post déborde : ${post} pt pour ${USABLE} pt`);
    assert.ok(USABLE - post > 40, `pas assez de suivant visible : ${USABLE - post} pt`);
  });
});
