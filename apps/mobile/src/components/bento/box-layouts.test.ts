import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BOX_COLUMNS,
  BOX_GAP,
  BOX_INNER_HEIGHT,
  BOX_INNER_WIDTH,
  BOX_LAYOUTS,
  BOX_ROTATIONS,
  boxPlacements,
  boxRowHeights,
  boxTileTextWidth,
  boxTileWidth,
} from '@bento-pop/supabase-mobile/bento';
import { GRID_GEOMETRY, GRID_WIDTH } from './geometry';

/**
 * La table des dispositions, verrouillée.
 *
 * Elle est la seule source des nombres pour les cinq dessins de la boîte.
 * Une erreur ici ne casse rien visiblement : elle décale une rangée de
 * quelques points dans un rendu et pas dans un autre, exactement comme
 * l'aperçu de lien l'a fait pendant des mois. D'où des invariants plutôt que
 * des valeurs recopiées.
 */

const COMPTES = [2, 3, 4, 5, 6] as const;

describe('table des dispositions', () => {
  it('couvre 2 à 6 cases, et rien d’autre', () => {
    assert.deepEqual(
      Object.keys(BOX_LAYOUTS).map(Number).sort((a, b) => a - b),
      [...COMPTES],
    );
  });

  for (const n of COMPTES) {
    describe(`${n} cases`, () => {
      it('compte exactement ses cases', () => {
        const total = BOX_LAYOUTS[n]!.reduce((s, r) => s + r.cases, 0);
        assert.equal(total, n);
      });

      /**
       * L'invariant qui empêche la boîte d'être rognée ou de laisser un vide.
       * C'est celui que l'aperçu de lien violait : ses rangées remplissaient
       * bien la hauteur, mais pas dans ces proportions.
       */
      it('remplit exactement l’intérieur du cadre', () => {
        const rows = BOX_LAYOUTS[n]!;
        const hauteurs = rows.reduce((s, r) => s + r.height, 0);
        const ecarts = BOX_GAP * (rows.length - 1);
        assert.equal(hauteurs + ecarts, BOX_INNER_HEIGHT, `${n} cases`);
      });

      it('ouvre sur un compartiment vedette', () => {
        // La règle de Rob : toute disposition commence par une rangée d'une
        // seule case. Sans elle, la boîte se lit comme une grille.
        assert.equal(BOX_LAYOUTS[n]![0]!.cases, 1);
      });

      it('ne met trois cases sur une rangée qu’à six', () => {
        // Mesuré : une case de rangée à trois offre 80 points utiles, et un
        // intitulé tient sur deux lignes sans réduction. « Le film qui t'a
        // fait pleurer » y demande trois lignes.
        const aTrois = BOX_LAYOUTS[n]!.some((r) => r.cases === 3);
        assert.equal(aTrois, n === 6, `${n} cases`);
      });

      it('couvre toutes les colonnes de la grille web sur chaque rangée', () => {
        for (const place of boxPlacements(n)) {
          assert.equal(place.span * place.casesInRow, BOX_COLUMNS);
        }
      });

      it('garde des rotations discrètes', () => {
        for (const place of boxPlacements(n)) {
          assert.ok(Math.abs(place.rotate) <= 1, `position ${place.index}`);
        }
      });
    });
  }
});

describe('le bento principal ne bouge pas', () => {
  /**
   * Le test qui compte le plus de ce fichier. Six cases, c'est la boîte que
   * 27 personnes ont publiée : ses nombres sont ceux d'avant le chantier 13,
   * recopiés ici depuis `BentoGrid.tsx` tel qu'il était.
   */
  it('reprend les hauteurs de rangée de l’existant', () => {
    assert.deepEqual(boxRowHeights(6), [
      GRID_GEOMETRY.H_FILM,
      GRID_GEOMETRY.H_MID,
      GRID_GEOMETRY.H_SM,
    ]);
    assert.deepEqual(boxRowHeights(6), [220, 134, 100]);
  });

  it('reprend les rotations de l’existant, dans l’ordre', () => {
    // film, série, artiste, chanson, créateur, lieu.
    assert.deepEqual(
      boxPlacements(6).map((p) => p.rotate),
      [-0.5, 0.4, -0.3, -0.3, 0.5, -0.2],
    );
  });

  it('reprend les gabarits de l’existant', () => {
    assert.deepEqual(
      boxPlacements(6).map((p) => p.size),
      ['lg', 'md', 'md', 'sm', 'sm', 'sm'],
    );
  });

  it('reprend les portées web de l’existant', () => {
    assert.deepEqual(boxPlacements(6).map((p) => p.span), [6, 3, 3, 2, 2, 2]);
  });
});

describe('géométrie dérivée', () => {
  it('accorde la largeur intérieure avec la géométrie de l’app', () => {
    const interieur = GRID_WIDTH - (GRID_GEOMETRY.PAD + GRID_GEOMETRY.BORDER) * 2;
    assert.equal(BOX_INNER_WIDTH, interieur);
  });

  it('accorde la hauteur intérieure avec la géométrie de l’app', () => {
    const rows = GRID_GEOMETRY.H_FILM + GRID_GEOMETRY.H_MID + GRID_GEOMETRY.H_SM;
    assert.equal(BOX_INNER_HEIGHT, rows + GRID_GEOMETRY.GAP * 2);
  });

  it('rend les trois largeurs de case connues', () => {
    assert.equal(boxTileWidth(1), 323);
    assert.equal(boxTileWidth(2), 156.5);
    assert.equal(boxTileWidth(3), 101);
  });

  /**
   * Les valeurs mesurées le 16 septembre 2026 avec la police Bungee réelle,
   * en capitales, interlettrage 1,2. Ce sont elles qui décident si un
   * intitulé d'édition tient, et le back-office applique la même règle.
   */
  it('rend les trois largeurs utiles mesurées', () => {
    // Case moins sa marge de 8 et son pointillé de 2, des deux côtés.
    assert.equal(boxTileTextWidth(1), 303);
    assert.equal(boxTileTextWidth(2), 136.5);
    assert.equal(boxTileTextWidth(3), 81);
  });
});

describe('un nombre de cases non dessiné', () => {
  it('dégrade au lieu de lever', () => {
    // Une édition d'un nombre inconnu ne doit pas faire planter un rendu :
    // les appelants sautent déjà les cases qu'ils ne savent pas placer.
    assert.deepEqual(boxPlacements(7), []);
    assert.deepEqual(boxPlacements(1), []);
    assert.deepEqual(boxRowHeights(0), []);
  });
});

describe('témoin', () => {
  /**
   * Si la table était vidée ou renommée, tous les tests ci-dessus passeraient
   * en n'examinant rien.
   */
  it('a bien cinq dispositions et six rotations', () => {
    assert.equal(Object.keys(BOX_LAYOUTS).length, 5);
    assert.equal(BOX_ROTATIONS.length, 6);
    assert.equal(boxPlacements(6).length, 6);
  });
});
