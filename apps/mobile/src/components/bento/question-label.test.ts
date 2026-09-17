import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MAIN_CASES,
  boxPlacements,
  isMainCaseKey,
  promptFit,
} from '@bento-pop/supabase-mobile/bento';
import { feedBoxWidth, feedScale } from '../feed/layout';
import { composeBentoScale } from './compose-layout';
import { TILE_MAX_FONT_MULTIPLIER, fontScaleFor } from './font-scaling';
import { gridBorderWidth, gridTileWidth } from './geometry';
import { publicBentoScale, publicSideInset } from './public-layout';
import {
  TILE_LABEL_MAX_LINES,
  TILE_LABEL_MIN_FONT,
  TILE_QUESTION_PADDING_H,
  tileConf,
  tileLabelFit,
  tileLabelFontSize,
  tileLabelTextWidth,
  tileLabelWrap,
  tileTextLayout,
  type TileSize,
} from './tile-text';

/**
 * La question d'une édition sur la case remplie, proposition A.
 *
 * À la première capture, « Ton voyage rêvé » s'affichait « TON / VOYAG… » dans
 * une petite case de la page publique d'un iPhone 17 Pro, alors que le
 * back-office l'avait acceptée. Ce fichier verrouille la promesse inverse :
 * **ce que le back-office accepte s'affiche entier**, partout où l'app dessine
 * une boîte, sur les téléphones mesurés, à toute taille de police.
 */

type Rendu = { nom: string; box: number; scale: number; pixelRatio?: number; fontScaling: boolean };

const TELEPHONES = [
  { nom: 'iPhone SE', w: 375, h: 667, top: 20, bottom: 0 },
  { nom: 'iPhone 17 Pro', w: 402, h: 874, top: 62, bottom: 34 },
  { nom: 'iPhone 17 Pro Max', w: 440, h: 956, top: 62, bottom: 34 },
  { nom: 'Pixel 8', w: 411, h: 914, top: 24, bottom: 24, pixelRatio: 2.625 },
];

/** Les rendus de l'app : composer, fil et page publique, et l'image de partage. */
const RENDUS: Rendu[] = [
  ...TELEPHONES.flatMap((t): Rendu[] => {
    const page = publicBentoScale({
      width: t.w, height: t.h, insetTop: t.top, insetBottom: t.bottom, fontScale: 1, otherBentos: 2,
    });
    return [
      {
        nom: `composer ${t.nom}`,
        box: t.w - 32,
        scale: composeBentoScale({ screenHeight: t.h, insetTop: t.top, tabBarHeight: 84, fontScale: 1, bentoCount: 3 }),
        pixelRatio: t.pixelRatio,
        fontScaling: true,
      },
      { nom: `fil ${t.nom}`, box: feedBoxWidth(t.w), scale: feedScale(t.w), pixelRatio: t.pixelRatio, fontScaling: true },
      { nom: `page ${t.nom}`, box: t.w - publicSideInset(t.w, page) * 2, scale: page, pixelRatio: t.pixelRatio, fontScaling: true },
    ];
  }),
  { nom: 'image de partage', box: 920, scale: 2.5, fontScaling: false },
];

/** Tailles de police système : défaut, xxLarge, et la plus grande. */
const POLICES = [1, 1.235, 3.571];

const TAILLE: Record<1 | 2 | 3, TileSize> = { 1: 'lg', 2: 'md', 3: 'sm' };

/** Ce que `Tile` calcule pour une question, reproduit pas à pas. */
function dessin(question: string, cols: 1 | 2 | 3, hauteur: number, rendu: Rendu, fontScale: number) {
  const size = TAILLE[cols];
  const conf = tileConf(size, rendu.scale);
  const largeur = gridTileWidth(rendu.box, rendu.scale, cols, gridBorderWidth(rendu.scale));
  const texte = tileLabelTextWidth(largeur, conf.pad, TILE_QUESTION_PADDING_H);
  const police = rendu.fontScaling ? fontScale : 1;
  const lignes = tileLabelFit(
    question,
    texte,
    conf.stamp * fontScaleFor(police, TILE_MAX_FONT_MULTIPLIER),
    rendu.pixelRatio,
  ).lines;
  const { textScale } = tileTextLayout(hauteur * rendu.scale, size, rendu.scale, police, lignes);
  const fit = tileLabelFit(question, texte, conf.stamp * textScale, rendu.pixelRatio);
  const dessinee = rendu.pixelRatio === undefined
    ? fit.fontSize
    : Math.ceil(fit.fontSize * rendu.pixelRatio) / rendu.pixelRatio;
  return { lignesDessinees: tileLabelWrap(question, texte, dessinee).lines, taille: fit.fontSize };
}

/** Des questions réalistes : déterminant, nom, complément. 2 736 en tout. */
function questions(): string[] {
  const dets = ['Ton', 'Ta', 'Le', 'La', 'Celui qui', 'Celle qui', 'Ton meilleur', 'Ta pire'];
  const noms = ['film', 'série', 'son', 'jeu', 'manga', 'livre', 'lieu', 'plat', 'idole', 'voyage',
    'anime', 'BD', 'chanson', 'star', 'podcast', 'héros', 'ville', 'album'];
  const complements = ['', 'culte', 'doudou', 'rêvé', 'd’ado', 'de chevet', 'refuge', 'de l’été', 'de Noël',
    'secret', 'surcoté', 'qui t’a fait pleurer', 'que tu caches', 't’a marqué', 'de 2010', 'préféré',
    'de rupture', 'du dimanche', 'inavouable'];
  return dets.flatMap((d) => noms.flatMap((n) => complements.map((c) => `${d} ${n}${c ? ` ${c}` : ''}`)));
}

describe('tileLabelFontSize', () => {
  it('ne touche pas une question qui tient', () => {
    assert.equal(tileLabelFontSize('Ton film doudou', 60, 7), 7);
  });

  it('réduit juste assez « Ton voyage rêvé », la question tronquée de la première capture', () => {
    // Page publique d'un iPhone 17 Pro, rangée à trois : 58,9 points de texte à 7.
    const taille = tileLabelFontSize('Ton voyage rêvé', 58.9, 8.4);
    assert.ok(taille < 8.4 && taille >= TILE_LABEL_MIN_FONT, String(taille));
    assert.ok(tileLabelWrap('Ton voyage rêvé', 58.9, taille).lines <= TILE_LABEL_MAX_LINES);
    assert.equal(tileLabelWrap('Ton voyage rêvé', 58.9, taille + 0.01).lines, 3);
  });

  it('ne descend jamais sous 7 points : au-delà, la question se tronque', () => {
    assert.equal(tileLabelFontSize('Le film que tu reverrais ce soir', 30, 9), TILE_LABEL_MIN_FONT);
  });

  it('mesure sur Android la taille arrondie au pixel', () => {
    const taille = tileLabelFontSize('Ton voyage rêvé', 62, 9.6, 2.625);
    const dessinee = Math.ceil(taille * 2.625) / 2.625;
    assert.ok(tileLabelWrap('Ton voyage rêvé', 62, dessinee).lines <= TILE_LABEL_MAX_LINES, String(dessinee));
  });
});

describe('ce que le back-office accepte s’affiche entier', () => {
  const toutes = questions();

  for (const cols of [1, 2, 3] as const) {
    it(`en rangée à ${cols}, dans chaque rendu de l’app, à toute taille de police`, () => {
      // La hauteur de la rangée dans une boîte où elle apparaît.
      const n = cols === 1 ? 2 : cols === 2 ? 3 : 6;
      const place = boxPlacements(n).find((p) => p.casesInRow === cols);
      assert.ok(place);
      const admises = toutes.filter((q) => promptFit(q, cols).fits);
      assert.ok(admises.length > 1000, `${admises.length} questions admises seulement`);
      const tronquees: string[] = [];
      for (const rendu of RENDUS) {
        for (const fontScale of POLICES) {
          for (const q of admises) {
            if (dessin(q, cols, place.height, rendu, fontScale).lignesDessinees > TILE_LABEL_MAX_LINES) {
              tronquees.push(`${rendu.nom}, police ${fontScale} : « ${q} »`);
            }
          }
        }
      }
      assert.deepEqual(tronquees.slice(0, 5), [], `${tronquees.length} questions tronquées`);
    });
  }
});

describe('le bento principal garde son tampon', () => {
  it('reconnaît ses six cases, et aucune case d’édition', () => {
    assert.ok(MAIN_CASES.every((c) => isMainCaseKey(c.key)));
    for (const key of ['rec2_1', 'ed7_3', 'film ', 'FILM']) assert.equal(isMainCaseKey(key), false, key);
  });
});
