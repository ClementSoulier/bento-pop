import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MIN_SCALE, composeBentoScale } from './compose-layout';
import { GRID_GEOMETRY } from './geometry';
import {
  TILE_PENDING_OVERHANG,
  TILE_PENDING_RING,
  tileAccessibilityLabel,
  tilePendingBadge,
} from './tile-pending';
import {
  TILE_BORDER,
  TILE_QUESTION_PADDING_H,
  TILE_STAMP_PADDING_H,
  TILE_STAMP_PADDING_V,
  tileConf,
  type TileSize,
} from './tile-text';

/**
 * La pastille d'une case en attente n'existe que dans le composer : ce sont ses
 * échelles qui comptent. Le Pixel 8 y figure deux fois, avec les marges de
 * `question-label.test.ts` et avec celles qui redonnent l'échelle relevée sur
 * l'émulateur le 17 septembre 2026, 0,941 avec la bande de sélection et non
 * 0,992.
 */
const COMPOSERS = [
  { nom: 'iPhone SE', h: 667, top: 20 },
  { nom: 'iPhone 17 Pro', h: 874, top: 62 },
  { nom: 'iPhone 17 Pro Max', h: 956, top: 62 },
  { nom: 'Pixel 8', h: 914, top: 24 },
  { nom: 'Pixel 8 relevé', h: 914.3, top: 50.5 },
];

/** Tailles de police système : iOS de xSmall à la plus grande, Android jusqu'à 2. */
const POLICES = [0.823, 1, 1.235, 2, 3.571];

const TAILLES: TileSize[] = ['sm', 'md', 'lg'];

/** Écart minimal voulu entre la pastille et ce qu'elle ne doit pas toucher, en points. */
const ECART = 2;

/** Les échelles du composer : un bento seul, puis la bande de sélection. */
function echelles(): { cas: string; scale: number }[] {
  return COMPOSERS.flatMap((c) =>
    POLICES.flatMap((police) =>
      [1, 3].map((bentoCount) => ({
        cas: `${c.nom}, police ${police}, ${bentoCount} bento(s)`,
        scale: composeBentoScale({
          screenHeight: c.h,
          insetTop: c.top,
          tabBarHeight: 84,
          fontScale: police,
          bentoCount,
        }),
      })),
    ),
  );
}

describe('tilePendingBadge', () => {
  it('prend la hauteur d’une ligne d’étiquette à la taille par défaut, cercle compris', () => {
    // Petite case du composer d'un iPhone 17 Pro avec la bande de sélection :
    // étiquette de 7 pt, 8,75 de ligne et 4 de marge, plus le cercle.
    const { diameter, overhang } = tilePendingBadge('sm', 0.84);
    assert.equal(diameter, 7 * 1.25 + 2 * 2 + TILE_PENDING_RING * 2);
    assert.equal(overhang, TILE_PENDING_OVERHANG);
  });

  it('ne touche jamais le texte d’une étiquette, même pleine largeur, à toute taille de police', () => {
    // La pastille est un disque centré à `rayon - débord` du coin haut droit,
    // vers l'intérieur. Le texte de l'étiquette commence sous sa marge et,
    // pour une question qui remplit la case, finit à sa marge de droite : le
    // point de texte le plus proche est ce coin-là, tant que le centre du
    // disque reste au-dessus et à droite de lui. C'est la borne de toutes les
    // questions, et le tampon, plus court, en est plus loin encore.
    const pires: string[] = [];
    let cases = 0;
    for (const { cas, scale } of echelles()) {
      for (const size of TAILLES) {
        const conf = tileConf(size, scale);
        const { diameter, overhang } = tilePendingBadge(size, scale);
        const rayon = diameter / 2;
        const centre = rayon - overhang;
        const texteDroite =
          TILE_BORDER + conf.pad + Math.min(TILE_QUESTION_PADDING_H, TILE_STAMP_PADDING_H);
        const texteHaut = TILE_BORDER + conf.pad + TILE_STAMP_PADDING_V;
        assert.ok(centre < texteDroite && centre < texteHaut, `${cas}, ${size} : modèle invalide`);
        // 2,3 pt au plus serré, dans une petite case du composer d'un iPhone SE.
        const ecart = Math.hypot(texteDroite - centre, texteHaut - centre) - rayon;
        if (ecart < ECART) pires.push(`${cas}, ${size} : ${ecart.toFixed(2)} pt`);
        cases += 1;
      }
    }
    assert.deepEqual(pires, [], `pastille trop près du texte :\n  ${pires.join('\n  ')}`);
    // Témoin : une boucle vide passerait l'assertion précédente sans rien vérifier.
    assert.equal(cases, COMPOSERS.length * POLICES.length * 2 * TAILLES.length);
  });

  it('laisse la case voisine à distance, et reste dans le cadre crème', () => {
    for (const { cas, scale } of [
      ...echelles(),
      { cas: 'plancher du composer', scale: MIN_SCALE },
    ]) {
      const { overhang } = tilePendingBadge('sm', scale);
      const ecartVoisine = GRID_GEOMETRY.GAP * scale - overhang;
      assert.ok(ecartVoisine >= ECART, `${cas} : ${ecartVoisine.toFixed(2)} pt de la case voisine`);
      assert.ok(overhang < GRID_GEOMETRY.PAD * scale, `${cas} : la pastille sort du cadre`);
    }
  });
});

describe('tileAccessibilityLabel', () => {
  it('lit une case validée comme avant', () => {
    assert.equal(
      tileAccessibilityLabel({ prompt: 'Film', title: 'Inception', subtitle: '2010' }),
      'Film : Inception, 2010',
    );
    assert.equal(
      tileAccessibilityLabel({ prompt: 'Lieu', title: 'Le Petit Bistrot', pending: false }),
      'Lieu : Le Petit Bistrot',
    );
  });

  it('annonce l’attente de validation, que la pastille ne dit plus en toutes lettres', () => {
    assert.equal(
      tileAccessibilityLabel({ prompt: 'Lieu', title: 'Le Petit Bistrot', pending: true }),
      'Lieu : Le Petit Bistrot, en attente de validation',
    );
    assert.equal(
      tileAccessibilityLabel({
        prompt: 'Ton voyage rêvé',
        title: 'Kyoto',
        subtitle: 'Japon',
        pending: true,
      }),
      'Ton voyage rêvé : Kyoto, Japon, en attente de validation',
    );
  });
});
