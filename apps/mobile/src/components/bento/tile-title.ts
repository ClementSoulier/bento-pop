/**
 * Mise en lignes du titre d'une case, `Tile`, et du libellé d'une case vide.
 *
 * Un titre ne se coupe qu'entre deux mots, ou après un trait d'union. Trois
 * cas, mesurés sur les 27 bentos publiés (chantier 7, lot 3) :
 *
 * - un mot seul n'a aucune autre coupure : plus large que sa case, il se
 *   coupait au milieu sur les deux plateformes, « ARDÈCH / E » sur un iPhone
 *   17 Pro dès la taille de police xxLarge. Il reste sur une ligne, et
 *   rétrécit juste assez pour y tenir ;
 * - plusieurs mots tiennent en deux lignes et tronquent leur fin. Un premier
 *   mot plus large que la ligne s'y coupait pourtant, faute d'autre coupure
 *   avant lui : « KICKSTAR / T » sur iPhone, « KICK- / START » sur Android.
 *   Le titre rétrécit alors juste assez pour que ce premier mot tienne, cf.
 *   `tileTitleScale`. Les mots suivants, eux, passent à la ligne, et un mot
 *   trop large en dernière ligne se tronque : « JIMMY / PUNCHLI… » ;
 * - les kana, idéogrammes et hangûl se coupent entre deux caractères : deux
 *   lignes, sans rien mesurer.
 *
 * Aucun import de `react-native` : testé sous `node:test`.
 */

import { extendaTextWidth } from './extenda-metrics';

export type TileTitleFit = {
  numberOfLines: 1 | 2;
  adjustsFontSizeToFit: boolean;
};

/**
 * Une espace où la ligne peut se couper. Les espaces insécables n'en sont pas :
 * « SPIDER-MAN 2 » écrit avec une insécable reste un seul bloc.
 */
const BREAKING_SPACE = /[^\S\u00a0\u2007\u202f]/;

/** Traits d'union après lesquels la ligne peut se couper, l'insécable U+2011 exclu. */
const BREAKING_HYPHEN = /[-\u2010]/;

/**
 * Kana, idéogrammes et hangûl : la ligne peut s'y couper entre deux
 * caractères, sans espace. Un titre japonais long garde ses deux lignes au
 * lieu de rétrécir sur une seule.
 */
const BREAKS_BETWEEN_CHARACTERS = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/;

export function tileTitleFit(title: string): TileTitleFit {
  const text = title.trim();
  const singleWord = !BREAKING_SPACE.test(text) && !BREAKS_BETWEEN_CHARACTERS.test(text);
  return singleWord
    ? { numberOfLines: 1, adjustsFontSizeToFit: true }
    : { numberOfLines: 2, adjustsFontSizeToFit: false };
}

/**
 * Début d'un texte que la ligne ne peut pas couper : jusqu'à la première
 * espace sécable, ou jusqu'au premier trait d'union, compris.
 */
export function firstUnbreakable(text: string): string {
  let end = 0;
  for (const char of text) {
    if (BREAKING_SPACE.test(char)) break;
    end += char.length;
    if (BREAKING_HYPHEN.test(char)) break;
  }
  return text.slice(0, end);
}

/**
 * Retiré à la ligne avant de mesurer : un mot qui la remplirait exactement ne
 * tiendrait qu'au gré des arrondis de la plateforme. Un dixième de point ne se
 * voit pas.
 */
export const TITLE_ROUNDING_SLACK = 0.1;

/**
 * Facteur à appliquer à la police d'un titre de plusieurs mots pour que son
 * premier mot tienne dans `lineWidth`. Vaut 1 s'il y tient déjà, et pour les
 * titres que `tileTitleFit` règle sans mesure.
 *
 * La mesure majore le rendu, cf. `extendaTextWidth` : le titre ne rétrécit
 * jamais trop peu. L'espacement des lettres ne suit pas la police : il est mis
 * à part avant de mettre à l'échelle.
 *
 * `pixelRatio`, sur Android seulement : React Native 0.86 y arrondit la police
 * au pixel supérieur (`TextAttributeProps.setFontSize`), et un titre y est
 * dessiné jusqu'à un pixel plus grand que demandé. Réduit pour remplir sa ligne
 * au point près, « TELEGRAPH » y passait de 30,4 à 31 px et se coupait encore,
 * « TELE- / GRAPH » sur l'émulateur Pixel 8 à 411 dp. La mesure prend donc la
 * taille arrondie, et la réduction s'arrête sur un pixel entier.
 */
export function tileTitleScale(
  title: string,
  lineWidth: number,
  fontSize: number,
  letterSpacing: number,
  pixelRatio?: number,
): number {
  const text = title.trim();
  const measured =
    lineWidth > 0 &&
    fontSize > 0 &&
    !tileTitleFit(text).adjustsFontSizeToFit &&
    !BREAKS_BETWEEN_CHARACTERS.test(text);
  if (!measured) return 1;

  const word = firstUnbreakable(text.normalize('NFC').toUpperCase());
  const spacing = letterSpacing * [...word].length;
  // Largeur des glyphes pour une police de 1, espacement à part.
  const glyphs = (extendaTextWidth(word, fontSize, letterSpacing) - spacing) / fontSize;
  const room = lineWidth - TITLE_ROUNDING_SLACK;
  const rendered = (size: number) =>
    pixelRatio === undefined ? size : Math.ceil(size * pixelRatio) / pixelRatio;
  if (glyphs * rendered(fontSize) + spacing <= room) return 1;

  const largest = (room - spacing) / glyphs;
  // Un pixel entier, moins un centième que l'arrondi au pixel supérieur rattrape.
  const size =
    pixelRatio === undefined ? largest : (Math.floor(largest * pixelRatio) - 0.01) / pixelRatio;
  return Math.max(0, size / fontSize);
}

/**
 * Mise en lignes du libellé d'une case vide, `EmptyTile` : les lignes d'un
 * titre, mais un libellé ne se tronque jamais. Trop large pour elles, il
 * rétrécit : « CRÉATEUR DE CONTENU » passait sinon sur trois lignes, cf.
 * `emptyTileLabelScale`.
 */
export function emptyTileLabelFit(label: string): TileTitleFit {
  return { numberOfLines: tileTitleFit(label).numberOfLines, adjustsFontSizeToFit: true };
}
