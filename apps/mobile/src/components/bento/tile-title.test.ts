import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CATEGORY_META } from '@bento-pop/supabase-mobile/bento';
import { extendaTextWidth } from './extenda-metrics';
import {
  TITLE_MIN_SCALE,
  TITLE_ROUNDING_SLACK,
  emptyTileLabelFit,
  firstUnbreakable,
  tileTitleFit,
  tileTitleScale,
} from './tile-title';

const ONE_LINE = { numberOfLines: 1, adjustsFontSizeToFit: true } as const;
const TWO_LINES = { numberOfLines: 2, adjustsFontSizeToFit: false } as const;

describe('tileTitleFit', () => {
  it('garde un mot seul sur une ligne, qui rétrécit plutôt que de se couper', () => {
    assert.deepEqual(tileTitleFit('Ardèche'), ONE_LINE);
    assert.deepEqual(tileTitleFit('Squeezie'), ONE_LINE);
  });

  it('traite un mot à traits d’union comme un mot seul', () => {
    assert.deepEqual(tileTitleFit('Spider-Man'), ONE_LINE);
  });

  it('donne deux lignes à un titre de plusieurs mots', () => {
    assert.deepEqual(tileTitleFit('Jimmy Punchline'), TWO_LINES);
    assert.deepEqual(tileTitleFit('Merry-Go-Round of Life'), TWO_LINES);
    assert.deepEqual(
      tileTitleFit("Le Seigneur des anneaux : La Communauté de l'anneau"),
      TWO_LINES,
    );
  });

  it('ne compte pas les espaces autour du titre', () => {
    assert.deepEqual(tileTitleFit('  Mastu  '), ONE_LINE);
  });

  it('ne coupe pas à une espace insécable', () => {
    assert.deepEqual(tileTitleFit('Spider-Man\u00a02'), ONE_LINE);
    assert.deepEqual(tileTitleFit('Chapitre\u202f1'), ONE_LINE);
  });

  it('garde deux lignes aux écritures qui se coupent entre deux caractères', () => {
    assert.deepEqual(tileTitleFit('千と千尋の神隠し'), TWO_LINES);
    assert.deepEqual(tileTitleFit('浦沢直樹'), TWO_LINES);
    assert.deepEqual(tileTitleFit('기생충'), TWO_LINES);
  });
});

describe('firstUnbreakable', () => {
  it('s’arrête à la première espace sécable', () => {
    assert.equal(firstUnbreakable('KICKSTART MY HEART'), 'KICKSTART');
  });

  it('garde le trait d’union, après lequel la ligne peut se couper', () => {
    assert.equal(firstUnbreakable('MERRY-GO-ROUND OF LIFE'), 'MERRY-');
    assert.equal(firstUnbreakable('C\u2010C\u2010C'), 'C\u2010');
  });

  it('traverse ce que la ligne ne coupe pas : insécables, trait d’union insécable', () => {
    assert.equal(firstUnbreakable('CHAPITRE\u202f1 SUITE'), 'CHAPITRE\u202f1');
    assert.equal(firstUnbreakable('C\u2011C\u2011C X'), 'C\u2011C\u2011C');
  });
});

type Line = { lineWidth: number; fontSize: number; letterSpacing: number; pixelRatio?: number };

/**
 * Ligne d'un titre de petite case, police et espacement, sur deux appareils
 * mesurés. Android arrondit la police au pixel, 2,625 px par dp sur le Pixel 8.
 */
const IPHONE_17_PRO_SM: Line = { lineWidth: 73.35, fontSize: 12, letterSpacing: 0.5 };
const ANDROID_411_SM: Line = {
  lineWidth: 74.08,
  fontSize: 13,
  letterSpacing: 0.5,
  pixelRatio: 2.625,
};

function scaleOn(title: string, line: Line): number {
  return tileTitleScale(title, line.lineWidth, line.fontSize, line.letterSpacing, line.pixelRatio);
}

/** Largeur du mot telle qu'Android la dessine : police arrondie au pixel supérieur. */
function androidWidth(word: string, fontSize: number, line: Line): number {
  const ratio = line.pixelRatio ?? 1;
  return extendaTextWidth(word, Math.ceil(fontSize * ratio) / ratio, line.letterSpacing);
}

/**
 * Le titre tient-il entier en deux lignes à ce facteur ? La mise en lignes est
 * refaite ici, sans passer par le modèle : c'est elle que le test vérifie.
 */
function fitsWhole(title: string, line: Line, scale: number): boolean {
  const ratio = line.pixelRatio;
  const size =
    ratio === undefined ? line.fontSize * scale : Math.ceil(line.fontSize * scale * ratio) / ratio;
  const room = line.lineWidth - TITLE_ROUNDING_SLACK;
  const pieces = title
    .normalize('NFC')
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((word) => word.split(/(?<=-)/).map((piece, i) => ({ piece, glued: i > 0 })));
  const lines: string[] = [];
  let current = '';
  for (const { piece, glued } of pieces) {
    const candidate = current === '' ? piece : glued ? current + piece : `${current} ${piece}`;
    if (current === '' || extendaTextWidth(candidate, size, line.letterSpacing) <= room) {
      current = candidate;
    } else {
      lines.push(current);
      current = piece;
    }
  }
  if (current) lines.push(current);
  return (
    lines.length <= 2 && lines.every((l) => extendaTextWidth(l, size, line.letterSpacing) <= room)
  );
}

describe('tileTitleScale', () => {
  /**
   * Les coupures relevées sur les 27 bentos publiés : « KICKSTAR / T »,
   * « TELEGRAP / H » et « MEGALOVA / NIA » sur l'iPhone, et « SLEEP- / LESS »
   * en plus sur l'émulateur, dont les cases ont une police plus grande.
   */
  it('rétrécit un titre dont le premier mot se coupait', () => {
    for (const title of [
      'Kickstart My Heart',
      'Telegraph Dow in the Rivers',
      'Megalovania X Megalovania',
    ]) {
      assert.ok(scaleOn(title, IPHONE_17_PRO_SM) < 1, title);
    }
    assert.ok(scaleOn('sleepless deathbed - Invent Animate', ANDROID_411_SM) < 1);
  });

  it('ne touche pas un titre qui tenait déjà entier', () => {
    assert.equal(scaleOn('Top Gun', IPHONE_17_PRO_SM), 1);
    assert.equal(scaleOn('Jaws', IPHONE_17_PRO_SM), 1);
  });

  /**
   * « JIMMY / PUNCHLI… » relevé sur le fil : le mot trop large tombe en
   * dernière ligne, qui se tronquait. Il rétrécit désormais jusqu'à tenir.
   */
  it('rétrécit un titre dont la dernière ligne se tronquait', () => {
    for (const title of ['Jimmy Punchline', 'Bohemian Rhapsody', 'Alice in Borderland']) {
      const scale = scaleOn(title, IPHONE_17_PRO_SM);
      assert.ok(scale < 1 && scale >= TITLE_MIN_SCALE, `${title} : ${scale}`);
      assert.ok(fitsWhole(title, IPHONE_17_PRO_SM, scale), `${title} tronqué à ${scale}`);
    }
  });

  it('rétrécit juste ce qu’il faut : un point de plus et le titre se tronque', () => {
    const scale = scaleOn('Jimmy Punchline', IPHONE_17_PRO_SM);
    assert.ok(!fitsWhole('Jimmy Punchline', IPHONE_17_PRO_SM, scale + 0.005));
  });

  /**
   * « LE SEIGNEUR DES ANNEAUX : LA COMMUNAUTÉ DE L'ANNEAU » et « GLITCH
   * PRODUCTIONS » ne tiennent pas en deux lignes, même petits : ils s'arrêtent
   * au plancher et se tronquent, plutôt que de devenir illisibles.
   */
  it('ne descend pas sous le plancher pour un titre qui ne tiendra pas', () => {
    for (const title of [
      "Le Seigneur des anneaux : La Communauté de l'anneau",
      'Glitch Productions',
    ]) {
      const scale = scaleOn(title, IPHONE_17_PRO_SM);
      assert.ok(Math.abs(scale - TITLE_MIN_SCALE) < 1e-9, `${title} : ${scale}`);
    }
  });

  /**
   * Sauf pour le premier mot : coupé au milieu, il abîme plus la case qu'un
   * titre petit. « MEGALOVANIA » à 73,35 pt de ligne demande 0,71.
   */
  it('passe sous le plancher pour que le premier mot ne se coupe pas', () => {
    const scale = scaleOn('Megalovania X Megalovania', IPHONE_17_PRO_SM);
    assert.ok(scale < TITLE_MIN_SCALE, String(scale));
    const { fontSize, letterSpacing, lineWidth } = IPHONE_17_PRO_SM;
    const width = extendaTextWidth('MEGALOVANIA', fontSize * scale, letterSpacing);
    assert.ok(width <= lineWidth - TITLE_ROUNDING_SLACK, `${width} pour ${lineWidth}`);
  });

  it('coupe après un trait d’union, comme la plateforme', () => {
    // La ligne peut se couper après « MERRY- » ; avec un trait d'union
    // insécable, « MERRY‑GO‑ROUND » devient un seul mot, qui doit tenir.
    const coupable = scaleOn('Merry-Go-Round of Life', IPHONE_17_PRO_SM);
    const insecable = scaleOn('Merry\u2011Go\u2011Round of Life', IPHONE_17_PRO_SM);
    assert.ok(coupable > insecable, `${coupable} contre ${insecable}`);
    assert.ok(insecable < TITLE_MIN_SCALE, String(insecable));
  });

  it('rétrécit juste assez pour que le premier mot remplisse la ligne, au dixième de point près', () => {
    const { lineWidth, fontSize, letterSpacing } = IPHONE_17_PRO_SM;
    const scale = scaleOn('Kickstart My Heart', IPHONE_17_PRO_SM);
    const width = extendaTextWidth('KICKSTART', fontSize * scale, letterSpacing);
    const room = lineWidth - TITLE_ROUNDING_SLACK;
    assert.ok(Math.abs(width - room) < 1e-9, `${width} pour ${room}`);
  });

  /**
   * « TELEGRAPH » réduit pour remplir sa ligne au point près : 30,4 px de
   * police, que React Native arrondit à 31, et le mot se coupait encore.
   */
  it('mesure sur Android la police arrondie au pixel, et s’arrête sur un pixel entier', () => {
    const { lineWidth, fontSize } = ANDROID_411_SM;
    // Ce titre ne tient pas en deux lignes : il s'arrête au plancher, qui tombe
    // lui aussi sur le pixel entier en dessous, 25 px pour 25,59 demandés.
    const scale = scaleOn('Telegraph Dow in the Rivers', ANDROID_411_SM);
    const pixels = fontSize * scale * 2.625;
    assert.equal(Math.ceil(pixels), 25, String(pixels));
    assert.ok(pixels < 25, String(pixels));
    // Et « TELEGRAPH », qui se coupait en deux, tient sur sa ligne.
    assert.ok(androidWidth('TELEGRAPH', fontSize * scale, ANDROID_411_SM) <= lineWidth);
  });

  it('rétrécit sur Android un premier mot qui ne tient qu’avant l’arrondi', () => {
    // « KICKSTART » à 12 pt : 77,7 de large, 78,9 à 32 px de police.
    const line: Line = { lineWidth: 78.2, fontSize: 12, letterSpacing: 0.5 };
    assert.equal(scaleOn('Kickstart My Heart', line), 1);
    assert.ok(scaleOn('Kickstart My Heart', { ...line, pixelRatio: 2.625 }) < 1);
  });

  it('mesure les capitales que la case affiche, quelle que soit la casse du titre', () => {
    assert.equal(
      scaleOn('kickstart my heart', IPHONE_17_PRO_SM),
      scaleOn('Kickstart My Heart', IPHONE_17_PRO_SM),
    );
  });

  it('laisse à la plateforme les titres que `tileTitleFit` règle sans mesure', () => {
    // Un mot seul, qui rétrécit de lui-même, et une écriture qui se coupe entre deux caractères.
    assert.equal(scaleOn('Montpellier', { ...IPHONE_17_PRO_SM, lineWidth: 10 }), 1);
    assert.equal(scaleOn('千と千尋の神隠し', { ...IPHONE_17_PRO_SM, lineWidth: 10 }), 1);
  });

  it('ne mesure rien sans largeur de ligne', () => {
    assert.equal(scaleOn('Kickstart My Heart', { ...IPHONE_17_PRO_SM, lineWidth: 0 }), 1);
  });
});

describe('emptyTileLabelFit', () => {
  it('ne tronque jamais un libellé : une ligne par mot seul, deux au plus, qui rétrécissent', () => {
    const fits = Object.fromEntries(
      Object.values(CATEGORY_META).map(({ label }) => [label, emptyTileLabelFit(label)]),
    );
    assert.deepEqual(fits, {
      Film: ONE_LINE,
      Série: ONE_LINE,
      Artiste: ONE_LINE,
      Chanson: ONE_LINE,
      'Créateur de contenu': { numberOfLines: 2, adjustsFontSizeToFit: true },
      Lieu: ONE_LINE,
    });
  });
});
