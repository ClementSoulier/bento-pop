import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MAIN_CASES,
  QUESTION_LABEL_MAX_LINES,
  QUESTION_LABEL_MIN_FONT,
  filledCaseLabel,
  isMainCaseKey,
  promptFit,
} from '@bento-pop/supabase-mobile/bento';
import { TILE_TYPO, type TileSize } from './layout';
import { ogQuestionLabel, webQuestionLabel } from './question-label';

/**
 * La question d'une édition sur la case remplie, sur la page web et dans
 * l'aperçu de lien : proposition A, validée le 17 septembre 2026.
 *
 * Même promesse que dans l'app, `question-label.test.ts` côté mobile : ce que
 * le back-office accepte s'affiche entier.
 */

/** Échelle et arrondi de l'aperçu de lien, ceux de `opengraph-image.tsx`. */
const OG_SCALE = 1.06;
const ogRound = (n: number) => Math.round(n * OG_SCALE * 100) / 100;

const COLONNES: Record<TileSize, 1 | 2 | 3> = { lg: 1, md: 2, sm: 3 };

function questions(): string[] {
  const dets = ['Ton', 'Ta', 'Le', 'La', 'Celui qui', 'Celle qui', 'Ton meilleur', 'Ta pire'];
  const noms = ['film', 'série', 'son', 'jeu', 'manga', 'livre', 'lieu', 'plat', 'idole', 'voyage',
    'anime', 'BD', 'chanson', 'star', 'podcast', 'héros', 'ville', 'album'];
  const complements = ['', 'culte', 'doudou', 'rêvé', 'd’ado', 'de chevet', 'refuge', 'de l’été', 'de Noël',
    'secret', 'surcoté', 'qui t’a fait pleurer', 'que tu caches', 't’a marqué', 'de 2010', 'préféré',
    'de rupture', 'du dimanche', 'inavouable'];
  return dets.flatMap((d) => noms.flatMap((n) => complements.map((c) => `${d} ${n}${c ? ` ${c}` : ''}`)));
}

describe('ce que le back-office accepte s’affiche entier sur le web', () => {
  const toutes = questions();
  for (const size of ['lg', 'md', 'sm'] as const) {
    it(`en ${size}, page publique et aperçu de lien`, () => {
      const admises = toutes.filter((q) => promptFit(q, COLONNES[size]).fits);
      assert.ok(admises.length > 1000, `${admises.length} questions admises seulement`);
      const tronquees: string[] = [];
      for (const q of admises) {
        for (const [rendu, { fit, textWidth, boxTextWidth }] of [
          ['page', webQuestionLabel(q, size)],
          ['aperçu', ogQuestionLabel(q, size, OG_SCALE, ogRound)],
        ] as const) {
          if (fit.truncated || fit.lines.length > QUESTION_LABEL_MAX_LINES) tronquees.push(`${rendu} « ${q} »`);
          assert.ok(boxTextWidth <= textWidth + 1e-9, `${rendu} « ${q} » : fond plus large que la case`);
          assert.ok(fit.widest <= boxTextWidth + 1e-9, `${rendu} « ${q} » : ligne plus large que son fond`);
        }
      }
      assert.deepEqual(tronquees.slice(0, 5), [], `${tronquees.length} questions tronquées`);
    });
  }
});

describe('webQuestionLabel', () => {
  it('coupe « Ton voyage rêvé » en deux lignes dans une petite case, à la taille du tampon', () => {
    const { fit } = webQuestionLabel('Ton voyage rêvé', 'sm');
    assert.deepEqual(fit.lines, ['TON VOYAGE', 'RÊVÉ']);
    assert.equal(fit.fontSize, TILE_TYPO.sm.stamp);
  });

  it('ajuste le fond à la plus longue ligne, et non à toute la case', () => {
    const { fit, textWidth, boxTextWidth } = webQuestionLabel('Ton voyage rêvé', 'sm');
    assert.ok(boxTextWidth < textWidth, `${boxTextWidth} pour ${textWidth}`);
    assert.ok(boxTextWidth >= fit.widest);
  });

  it('laisse une question courte sur une ligne dans la grande case', () => {
    assert.deepEqual(webQuestionLabel('Le film qui t’a fait pleurer', 'lg').fit.lines, ['LE FILM QUI T’A FAIT PLEURER']);
  });

  it('ne descend jamais sous le plancher, et le signale', () => {
    const { fit } = webQuestionLabel('Le film que tu reverrais ce soir et demain matin encore', 'sm');
    assert.equal(fit.fontSize, QUESTION_LABEL_MIN_FONT);
    assert.equal(fit.truncated, true);
  });
});

describe('le bento principal garde son tampon sur le web', () => {
  it('affiche FILM, SÉRIE… et non les intitulés', () => {
    for (const c of MAIN_CASES) {
      assert.equal(isMainCaseKey(c.key), true, c.key);
      assert.equal(filledCaseLabel(c), c.stamp);
    }
  });
});
