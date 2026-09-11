import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CATEGORY_ORDER } from '@bento-pop/supabase-mobile/bento';
import {
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  FRAME,
  GRID_COLUMNS,
  ROW_HEIGHTS,
  TILE_LAYOUT,
  TILE_SIZES,
  TILE_TYPO,
  computeDesignHeight,
  tileWidth,
} from './layout';

describe('géométrie de la boîte', () => {
  /**
   * `DESIGN_HEIGHT` est une constante écrite à la main, mais elle découle
   * des hauteurs de rangée et des marges. Si quelqu'un modifie une hauteur
   * sans l'ajuster, l'image Open Graph — qui dimensionne son canevas à
   * partir de cette valeur — serait rognée ou laisserait un vide.
   */
  it('a une hauteur nominale cohérente avec ses composantes', () => {
    assert.equal(computeDesignHeight(), DESIGN_HEIGHT);
  });

  it('reprend les valeurs de la boîte de l’app mobile', () => {
    // Repères issus de `apps/mobile/src/components/bento/BentoGrid.tsx`.
    assert.deepEqual(ROW_HEIGHTS, [220, 134, 100]);
    assert.equal(FRAME.gap, 10);
    assert.equal(FRAME.padding, 14);
    assert.equal(FRAME.border, 5);
    assert.equal(DESIGN_HEIGHT, 512);
  });
});

describe('grille à six colonnes', () => {
  const inner = DESIGN_WIDTH - (FRAME.padding + FRAME.border) * 2;
  const column = (inner - FRAME.gap * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

  /** Largeur occupée par un compartiment couvrant `span` colonnes. */
  const spanWidth = (span: number) => column * span + FRAME.gap * (span - 1);

  /**
   * Le cœur du choix des six colonnes : elles doivent reproduire
   * **exactement** les largeurs qu'une disposition en rangées produirait
   * dans l'app. Sans ça, la boîte web ne serait pas superposable à celle
   * de l'app ni à l'image de partage.
   */
  it('reproduit les largeurs d’une disposition en rangées', () => {
    assert.equal(spanWidth(6), tileWidth(1), 'film, pleine largeur');
    assert.equal(spanWidth(3), tileWidth(2), 'série et artiste');
    assert.equal(spanWidth(2), tileWidth(3), 'chanson, créateur et lieu');
  });

  it('remplit exactement la largeur intérieure sur chaque rangée', () => {
    for (const row of [1, 2, 3] as const) {
      const tiles = TILE_LAYOUT.filter((t) => t.row === row);
      const spans = tiles.reduce((sum, t) => sum + t.span, 0);
      assert.equal(spans, GRID_COLUMNS, `la rangée ${row} ne couvre pas les 6 colonnes`);
    }
  });
});

describe('disposition des compartiments', () => {
  it('couvre les six catégories, une seule fois chacune', () => {
    const categories = TILE_LAYOUT.map((t) => t.category);
    assert.equal(categories.length, 6);
    assert.deepEqual([...categories].sort(), [...CATEGORY_ORDER].sort());
  });

  it('place le film en premier et en grand', () => {
    // Le compartiment film porte le `priority` de `next/image` : c'est le
    // LCP de la page. S'il cessait d'être le plus grand, il faudrait
    // déplacer ce `priority`.
    const film = TILE_LAYOUT.find((t) => t.category === 'film');
    assert.equal(film?.size, 'lg');
    assert.equal(film?.span, GRID_COLUMNS);
    assert.equal(TILE_LAYOUT[0]?.category, 'film');
  });

  it('garde des rotations discrètes', () => {
    for (const tile of TILE_LAYOUT) {
      assert.ok(
        Math.abs(tile.rotate) <= 1,
        `${tile.category} : rotation de ${tile.rotate}deg, trop marquée`,
      );
    }
  });

  it('déclare un indice `sizes` pour chaque gabarit', () => {
    for (const size of Object.keys(TILE_TYPO) as (keyof typeof TILE_TYPO)[]) {
      // Sans `sizes`, `next/image` sert la variante la plus large de
      // `deviceSizes` et l'essentiel du bénéfice sur l'egress est perdu.
      assert.match(TILE_SIZES[size], /vw/, `gabarit ${size}`);
    }
  });
});
