import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CATEGORY_ORDER, promptFit } from '@bento-pop/supabase-mobile/bento';
import {
  BENTO_ROWS,
  PLATE,
  dotsFadeLine,
  emptyBentoLabel,
  emptyTileContent,
  illustrationScale,
  plateMinHeight,
  plateRows,
  tagQuestionFit,
  tagType,
  tileAccessibilityLabel,
  tileInitial,
  tileMeasures,
  tileMinHeights,
  tilePrompt,
  tilePromptType,
  tileTextFit,
  tileTitleNudge,
  tileTitleSize,
  tileWidth,
  unbreakableChunks,
  type TileSize,
} from './bento-rules';
import { tileTitleWidth } from './tile-metrics';

/** Le bento vide du design (chantier 31, D3), aux mesures de `bundle.css`. */
describe('le bento vide', () => {
  it('range les six catégories dans l’ordre de la boîte : une, deux, trois', () => {
    assert.deepEqual(
      BENTO_ROWS.flat().map((tile) => tile.category),
      [...CATEGORY_ORDER],
    );
    assert.deepEqual(
      BENTO_ROWS.map((row) => row.map((tile) => tile.size).join()),
      ['xl', 'l,l', 's,s,s'],
    );
  });

  it('donne à ses cases les hauteurs de la maquette, plateau de 370 sur 402', () => {
    const heights = tileMinHeights(370);
    assert.equal(heights.xl, 175);
    assert.ok(Math.abs(heights.l - 143.33) < 0.01, `${heights.l}`);
    assert.ok(Math.abs(heights.s - 112.67) < 0.01, `${heights.s}`);
  });

  it('mesure 463 de haut sur 370 de large, comme à l’iPhone 17 Pro', () => {
    assert.ok(Math.abs(plateMinHeight(370) - 463) < 0.01, `${plateMinHeight(370)}`);
  });

  it('rapetisse en illustration quand la place manque, sans passer 0,72', () => {
    assert.equal(illustrationScale(463, 463), 1);
    assert.equal(illustrationScale(600, 463), 1);
    assert.ok(Math.abs(illustrationScale(332, plateMinHeight(343)) - 0.774) < 0.01);
    assert.equal(illustrationScale(100, 463), 0.72);
  });

  it('écrit ses libellés en 14/17, 12/14 dans une petite case', () => {
    assert.deepEqual(tilePromptType('xl', 1), { fontSize: 14, lineHeight: 17 });
    assert.deepEqual(tilePromptType('l', 1), { fontSize: 14, lineHeight: 17 });
    assert.deepEqual(tilePromptType('s', 1), { fontSize: 12, lineHeight: 14 });
  });

  it('arrête ses libellés à 130 %, avec leur hauteur de ligne', () => {
    const small = tilePromptType('s', 3);
    assert.ok(Math.abs(small.fontSize - 15.6) < 0.01, `${small.fontSize}`);
    assert.ok(Math.abs(small.lineHeight - 18.2) < 0.01, `${small.lineHeight}`);
  });

  it('garde « de » avec le mot qui le suit, et ne touche pas aux autres', () => {
    assert.equal(tilePrompt('Créateur de contenu'), 'Créateur de contenu');
    assert.equal(tilePrompt('Film'), 'Film');
  });

  it('se lit d’un seul libellé, les six catégories dans l’ordre', () => {
    assert.equal(
      emptyBentoLabel(),
      'Un bento vide, six cases : film, série, artiste, chanson, créateur de contenu, lieu',
    );
  });
});

/** Le bento plein (chantier 32), aux mesures de `bundle.css`. */
describe('les rangées d’un plateau', () => {
  const total = (count: number, width: number, density?: 'compose' | 'share') => {
    const rows = plateRows(count, width, density);
    const { gap, padding, border } = PLATE[density ?? 'compose'];
    return (
      rows.reduce((sum, row) => sum + row.height, 0) +
      (rows.length - 1) * gap +
      2 * (padding + border)
    );
  };

  it('garde les proportions du dossier à six cases', () => {
    const rows = plateRows(6, 370);
    assert.deepEqual(
      rows.map((row) => `${row.size}×${row.cases}`),
      ['xl×1', 'l×2', 's×3'],
    );
    const heights = tileMinHeights(370);
    assert.deepEqual(
      rows.map((row) => row.height),
      [heights.xl, heights.l, heights.s],
    );
  });

  it('prend les dispositions de Rob de 2 à 5 cases (D6)', () => {
    const shape = (count: number) =>
      plateRows(count, 370)
        .map((row) => `${row.size}×${row.cases}`)
        .join();
    assert.equal(shape(2), 'xl×1,xl×1');
    assert.equal(shape(3), 'xl×1,l×2');
    assert.equal(shape(4), 'xl×1,l×2,xl×1');
    assert.equal(shape(5), 'xl×1,l×2,l×2');
  });

  it('garde la même hauteur de plateau, de 2 à 6 cases (D6)', () => {
    for (const width of [343, 370, 380]) {
      for (const count of [2, 3, 4, 5, 6]) {
        assert.ok(
          Math.abs(total(count, width) - plateMinHeight(width)) < 0.01,
          `${count} cases, ${width} : ${total(count, width)} contre ${plateMinHeight(width)}`,
        );
      }
    }
  });

  it('rend de la hauteur à ce qui l’entoure, sans toucher à sa largeur (D8)', () => {
    const full = plateRows(6, 343);
    const reduced = plateRows(6, 343, 'compose', 0.85);
    full.forEach((row, index) => {
      assert.ok(Math.abs((reduced[index]?.height ?? 0) - row.height * 0.85) < 0.001);
    });
  });

  it('ne rend rien pour un nombre de cases hors des dispositions', () => {
    assert.deepEqual(plateRows(7, 370), []);
    assert.deepEqual(plateRows(1, 370), []);
  });

  it('compte l’image partagée aux mesures de `.mbp-plate--share`', () => {
    const inner = 960 - 2 * (5 + 14);
    const heights = tileMinHeights(960, 'share');
    assert.ok(Math.abs(heights.xl - (inner * 10) / 23) < 0.01);
    assert.ok(Math.abs(heights.l - (((inner - 12) / 2) * 5) / 7) < 0.01);
    assert.ok(Math.abs(heights.s - (((inner - 24) / 3) * 17) / 20) < 0.01);
    assert.ok(Math.abs(tileWidth(960, 3, 'share') - (inner - 24) / 3) < 0.01);
  });
});

describe('la puce', () => {
  it('mesure 22 de haut, 11/14 et ses marges, jusqu’à 130 %', () => {
    assert.equal(tagType(1).height, 22);
    assert.equal(tagType(1).fontSize, 11);
    assert.ok(Math.abs(tagType(3).fontSize - 14.3) < 0.01);
  });

  it('porte une question en deux lignes au plus (D2)', () => {
    for (const question of ['Ton voyage rêvé', 'Ton film doudou', 'Le son de ton été']) {
      const fit = tagQuestionFit({ question, width: 112.67, tile: 's', fontScale: 1 });
      assert.ok(fit.lines.length <= 2, `${question} : ${fit.lines.join(' / ')}`);
      assert.ok(fit.fontSize >= 9, `${question} : ${fit.fontSize}`);
    }
  });

  it('tient toute question que le back-office accepte, sans descendre sous 9', () => {
    const accepted = [
      'Le film qui t’a fait pleurer',
      'Celui qui t’a fait rire',
      'Ton idole d’ado',
      'La série que tu caches',
    ].filter((question) => promptFit(question, 3).fits);
    assert.ok(accepted.length > 0);
    for (const question of accepted) {
      for (const width of [103.3, 112.67, 116]) {
        const fit = tagQuestionFit({ question, width, tile: 's', fontScale: 1 });
        assert.ok(!fit.truncated, `${question} à ${width} : ${fit.lines.join(' / ')}`);
        assert.ok(fit.fontSize >= 9);
      }
    }
  });

  it('laisse la place du sablier à une question en attente', () => {
    const free = tagQuestionFit({
      question: 'La série que tu caches',
      width: 112.67,
      tile: 's',
      fontScale: 1,
    });
    const pending = tagQuestionFit({
      question: 'La série que tu caches',
      width: 112.67,
      tile: 's',
      fontScale: 1,
      pending: true,
    });
    assert.ok(pending.fontSize <= free.fontSize);
  });
});

describe('un titre de case', () => {
  it('se coupe entre les mots et après un trait d’union, jamais dans un idéogramme', () => {
    assert.deepEqual(unbreakableChunks('Le Mont-Saint-Michel'), [
      'Le',
      'Mont-',
      'Saint-',
      'Michel',
    ]);
    assert.deepEqual(unbreakableChunks('Paris 13ème'), ['Paris 13ème']);
    assert.deepEqual(unbreakableChunks('浦沢直樹'), []);
  });

  it('rétrécit juste assez pour que son plus long mot tienne', () => {
    const size = tileTitleSize({
      title: 'HugoDécrypte (média)',
      textWidth: 94.67,
      fontSize: 15,
      letterSpacing: 0.225,
    });
    assert.ok(size < 15 && size >= 11, `${size}`);
    assert.ok(tileTitleWidth('HugoDécrypte', size, 0.225) <= 94.67 + 0.5);
  });

  it('garde sa taille quand tout tient', () => {
    assert.equal(
      tileTitleSize({ title: 'Squeezie', textWidth: 94.67, fontSize: 15, letterSpacing: 0.225 }),
      15,
    );
  });

  it('ne descend pas sous le bento miniature', () => {
    assert.equal(
      tileTitleSize({
        title: 'Anticonstitutionnellement',
        textWidth: 85.7,
        fontSize: 15,
        letterSpacing: 0.225,
      }),
      11,
    );
  });

  it('tombe sur le pixel entier en dessous sur Android', () => {
    const size = tileTitleSize({
      title: 'Megalovania',
      textWidth: 98,
      fontSize: 15,
      letterSpacing: 0.225,
      pixelRatio: 2.625,
    });
    assert.ok(Math.ceil(size * 2.625) / 2.625 <= 15 * (98 / 101.5) + 0.01, `${size}`);
  });

  it('prend sa première lettre pour initiale', () => {
    assert.equal(tileInitial('Ponyo'), 'P');
    assert.equal(tileInitial('[unknown]'), 'U');
    assert.equal(tileInitial('été indien'), 'É');
    assert.equal(tileInitial('2 Broke Girls'), '2');
  });
});

describe('ce qu’une case garde (D7)', () => {
  const room = (
    fit: ReturnType<typeof tileTextFit>,
    tile: TileSize,
    tagHeight = 22,
    tagScale = 1,
  ) => {
    const { padding, tagInset } = tileMeasures(tile);
    return (
      padding +
      fit.titleLines * fit.title.lineHeight +
      (fit.subtitle ? fit.subtitle.lineHeight + fit.subtitle.gap : 0) +
      (fit.credit ? fit.credit.lineHeight + fit.credit.gap : 0) +
      tagInset +
      tagHeight * tagScale
    );
  };

  it('tient tout, à la lettre de la maquette, dans une grande case', () => {
    const fit = tileTextFit({
      title: 'Inception',
      width: 350,
      height: 175,
      tile: 'xl',
      fontScale: 1,
      hasSubtitle: true,
      hasCredit: true,
    });
    assert.equal(fit.titleLines, 2);
    assert.ok(fit.subtitle && fit.credit);
  });

  it('retire une ligne au titre avant le sous-titre, sur une petite case (`c07`)', () => {
    const fit = tileTextFit({
      title: 'How To Train Your Dragon',
      width: 112.67,
      height: 112.67,
      tile: 's',
      fontScale: 1,
      hasSubtitle: true,
      hasCredit: true,
    });
    assert.equal(fit.titleLines, 2);
    assert.ok(fit.subtitle, 'le sous-titre reste');
    assert.ok(fit.credit, 'le crédit reste');
    assert.ok(room(fit, 's') <= 112.67, `${room(fit, 's')}`);
  });

  it('garde trois lignes à un titre seul', () => {
    const fit = tileTextFit({
      title: 'Le Mont-Saint-Michel',
      width: 112.67,
      height: 112.67,
      tile: 's',
      fontScale: 1,
    });
    assert.equal(fit.titleLines, 3);
  });

  it('efface le sous-titre quand le plateau rapetisse (D8), le crédit restant', () => {
    const fit = tileTextFit({
      title: 'How To Train Your Dragon',
      width: 103.3,
      height: 103.3 * 0.85,
      tile: 's',
      fontScale: 1,
      hasSubtitle: true,
      hasCredit: true,
    });
    assert.equal(fit.subtitle, null);
    assert.ok(fit.credit);
    assert.equal(fit.titleLines, 2);
    assert.ok(room(fit, 's') <= 103.3 * 0.85, `${room(fit, 's')}`);
  });

  it('ne chevauche rien à 130 % sur la plus petite case', () => {
    const fit = tileTextFit({
      title: 'How To Train Your Dragon',
      width: 103.3,
      height: 103.3,
      tile: 's',
      fontScale: 1.3,
      hasSubtitle: true,
      hasCredit: true,
    });
    const tag = tagType(1.3).height;
    assert.ok(fit.credit);
    assert.ok(room(fit, 's', tag) <= 103.3, `${room(fit, 's', tag)}`);
  });

  it('fait place à une question sur deux lignes (D2)', () => {
    const fit = tileTextFit({
      title: 'How To Train Your Dragon',
      width: 112.67,
      height: 112.67,
      tile: 's',
      fontScale: 1,
      hasSubtitle: true,
      hasCredit: true,
      tagHeight: 36,
    });
    assert.equal(fit.subtitle, null);
    assert.ok(room(fit, 's', 36) <= 112.67, `${room(fit, 's', 36)}`);
  });

  it('compte la puce agrandie sur l’image partagée', () => {
    const measures = tileMeasures('s', 'share');
    const fit = tileTextFit({
      title: 'How To Train Your Dragon',
      width: tileWidth(960, 3, 'share'),
      height: tileMinHeights(960, 'share').s,
      tile: 's',
      density: 'share',
      fontScale: 1,
      hasSubtitle: true,
      hasCredit: true,
    });
    const used =
      measures.padding +
      fit.titleLines * fit.title.lineHeight +
      (fit.subtitle ? fit.subtitle.lineHeight + fit.subtitle.gap : 0) +
      (fit.credit ? fit.credit.lineHeight + fit.credit.gap : 0) +
      measures.tagInset +
      22 * measures.tagScale;
    assert.ok(used <= tileMinHeights(960, 'share').s, `${used}`);
    assert.ok(fit.titleLines >= 1);
  });
});

describe('une case vide', () => {
  it('garde le « + » et les écarts du dossier à six cases', () => {
    const heights = tileMinHeights(370);
    assert.deepEqual(emptyTileContent({ tile: 'xl', minHeight: heights.xl, fontScale: 1 }), {
      compact: false,
      plus: 36,
      gap: 8,
    });
    assert.deepEqual(emptyTileContent({ tile: 's', minHeight: heights.s, fontScale: 1 }), {
      compact: true,
      plus: 30,
      gap: 8,
    });
  });

  it('prend le « + » d’une petite case sur une rangée basse, large ou non', () => {
    const low = plateRows(4, 370)[2];
    assert.equal(low?.size, 'xl');
    const content = emptyTileContent({
      tile: 'xl',
      minHeight: low?.height,
      question: true,
      fontScale: 1,
    });
    assert.equal(content.compact, true);
    assert.equal(content.plus, 30);
  });

  it('tient sans grandir sur toutes les rangées, à l’iPhone SE compris (D6)', () => {
    for (const width of [343, 370, 380]) {
      for (const count of [2, 3, 4, 5, 6]) {
        for (const row of plateRows(count, width)) {
          const { plus, gap, compact } = emptyTileContent({
            tile: row.size,
            minHeight: row.height,
            question: true,
            fontScale: 1,
          });
          const prompt = tilePromptType(compact ? 's' : row.size, 1).lineHeight;
          const needed = 24 + plus + 2 * gap + 14 + prompt;
          assert.ok(
            needed <= row.height + 0.01,
            `${count} cases, ${width} : ${needed} > ${row.height}`,
          );
        }
      }
    }
  });

  it('ne serre pas ses écarts sous 2 points, le plateau grandit alors', () => {
    const { gap } = emptyTileContent({ tile: 's', minHeight: 60, question: true, fontScale: 1 });
    assert.equal(gap, 2);
  });
});

describe('la place du titre', () => {
  it('descend sur iOS dans une ligne aussi haute que la police, et remonte sur Android dans une moyenne', () => {
    assert.ok(Math.abs(tileTitleNudge('xl', 'ios', 28) - 2.66) < 0.01);
    assert.ok(Math.abs(tileTitleNudge('s', 'ios', 15) - 1.2) < 0.01);
    assert.equal(tileTitleNudge('l', 'ios', 20), 0);
    assert.equal(tileTitleNudge('xl', 'android', 28), 0);
    assert.ok(Math.abs(tileTitleNudge('l', 'android', 20) + 1.5) < 0.01);
  });
});

describe('une case pour le lecteur d’écran', () => {
  it('s’annonce en entier', () => {
    assert.equal(
      tileAccessibilityLabel({ label: 'Film', title: 'Inception', subtitle: '2010' }),
      'Film : Inception, 2010',
    );
    assert.equal(
      tileAccessibilityLabel({ label: 'Lieu', title: 'Le Pont Neuf', pending: true }),
      'Lieu : Le Pont Neuf, en attente de validation',
    );
  });
});

describe('les pois d’une case', () => {
  it('s’estompent depuis le haut à droite, comme le dégradé à 200 degrés', () => {
    const { x1, y1, x2, y2 } = dotsFadeLine(100, 100);
    assert.ok(x1 > x2 && y1 < y2, `${x1},${y1} vers ${x2},${y2}`);
    assert.ok(Math.abs((x1 + x2) / 2 - 50) < 0.001);
    assert.ok(Math.abs((y1 + y2) / 2 - 50) < 0.001);
  });
});
