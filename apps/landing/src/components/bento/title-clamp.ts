import { boxTileWidth } from '@bento-pop/supabase-mobile/bento';
import { extendaTextWidth } from '@bento-pop/supabase-mobile/extenda';
import { CASES_PAR_RANGEE, TILE, TILE_TYPO, type TileSize } from './layout';

/**
 * Le titre d'une case remplie sera-t-il coupé à deux lignes sur la page
 * publique ?
 *
 * Seul un titre coupé reçoit le rognage du bas, `.bento-tile-title-clamped`
 * dans `globals.css` : il masque la 3e ligne, que `-webkit-line-clamp` dessine
 * quand même et dont les accents dépassaient sous la 2e (« LA… » du Seigneur des
 * anneaux, relevé le 17 septembre 2026). Il entame aussi le bas de la 2e ligne,
 * queue des Q et des virgules : un titre qui tient en deux lignes ne doit pas le
 * recevoir. Or aucun sélecteur CSS ne dit qu'un texte a été coupé, d'où cette
 * estimation côté serveur.
 *
 * En unités de design, comme `webQuestionLabel` : la boîte se met à l'échelle en
 * unités de conteneur, l'estimation vaut à toute largeur.
 *
 * **Elle ne compte jamais moins de lignes que le navigateur**, pour qu'aucun
 * titre coupé ne garde sa trace :
 * - les largeurs d'Extenda, sans crénage, majorent le rendu, cf.
 *   `extendaTextWidth` ; un caractère absent de la police compte pour son plus
 *   large glyphe, un idéogramme pour 1 em ;
 * - elle ne coupe la ligne qu'aux endroits où tout navigateur le peut aussi.
 *   Avec moins de coupures possibles que lui, le compte ne peut que s'allonger ;
 * - une unité de marge couvre la bordure de 2 px minimum des écrans de moins de
 *   330 px, jusqu'à 281 px.
 *
 * L'erreur inverse, un titre de deux lignes compté sur trois, ne coûte que ce
 * rognage. Relevé contre Chrome le 17 septembre 2026, sur les 277 titres du
 * catalogue aux trois gabarits : aucun titre coupé manqué, 4 titres de deux
 * lignes comptés sur trois, aucun parmi les 162 cases publiées.
 *
 * Pure, sans React ni `next` : testée sous `node:test`.
 */

/** Une espace où la ligne peut se couper. Les espaces insécables n'en sont pas. */
const BREAKING_SPACE = /[^\S\u00a0\u2007\u202f]/;

/**
 * Traits d'union et tirets après lesquels la ligne peut se couper, sauf devant
 * un chiffre : « BLINK-182 » reste d'un bloc (UAX #14, règle LB25).
 */
const BREAKING_HYPHEN = /[-\u2010\u2013\u2014]/;

/** Kana, idéogrammes et hangûl : la ligne peut se couper entre deux caractères. */
const BREAKS_BETWEEN_CHARACTERS =
  /[\u3041-\u3096\u30a1-\u30fa\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/;

/** Petits kana et trait d'allongement, qui ne commencent pas une ligne. */
const SMALL_KANA =
  /[\u3041\u3043\u3045\u3047\u3049\u3063\u3083\u3085\u3087\u308e\u3095\u3096\u30a1\u30a3\u30a5\u30a7\u30a9\u30c3\u30e3\u30e5\u30e7\u30ee\u30f5\u30f6\u30fc]/;

/**
 * Ponctuation qui ne commence pas une ligne, même après une espace : le
 * navigateur garde « ANNEAUX : » ensemble (UAX #14, règle LB13).
 */
const NO_BREAK_BEFORE = /^[:;!?,.\u2026)\]}\u00bb\u201d\u2019%\u3001\u3002]/;

/** Ponctuation qui ne finit pas une ligne : un guillemet ouvrant reste avec le mot qui le suit. */
const NO_BREAK_AFTER = /[\u00ab\u201c\u2018([{\u00bf\u00a1]$/;

/** Un morceau fait seulement de ponctuation ou de symboles, « - » ou « & ». */
const ONLY_PUNCTUATION = /^[\p{P}\p{S}]+$/u;

/**
 * Retirée à la largeur de la ligne. La bordure d'une case vaut
 * `max(2px, 2.5 unités)` : sous 0,8 px par unité, elle grossit et la ligne
 * rétrécit, d'une unité à 0,67 px par unité.
 */
const SMALL_SCREEN_SLACK = 1;

/** Un morceau que la ligne ne peut pas couper, et ce qui le sépare du précédent. */
type Chunk = { text: string; before: '' | ' ' };

/** Le titre découpé aux seuls endroits où tout navigateur peut couper la ligne. */
function titleChunks(text: string): Chunk[] {
  const chunks: Chunk[] = [];
  let current = '';
  let before: Chunk['before'] = '';
  const flush = (next: Chunk['before']) => {
    if (current) {
      chunks.push({ text: current, before });
      before = next;
    } else if (next === ' ' && chunks.length > 0) {
      before = ' ';
    }
    current = '';
  };

  const chars = [...text];
  chars.forEach((char, i) => {
    if (BREAKING_SPACE.test(char)) return flush(' ');
    if (current && BREAKS_BETWEEN_CHARACTERS.test(char) && !SMALL_KANA.test(char)) flush('');
    current += char;
    if (BREAKING_HYPHEN.test(char) && !/\d/.test(chars[i + 1] ?? '')) flush('');
  });
  flush('');

  const glued: Chunk[] = [];
  for (const chunk of chunks) {
    const previous = glued[glued.length - 1];
    const noBreak =
      NO_BREAK_BEFORE.test(chunk.text) ||
      ONLY_PUNCTUATION.test(chunk.text) ||
      (previous !== undefined && NO_BREAK_AFTER.test(previous.text));
    if (previous && noBreak) previous.text += chunk.before + chunk.text;
    else glued.push({ ...chunk });
  }
  return glued;
}

/** Largeur d'une ligne, en unités de design : Extenda, ou 1 em par idéogramme. */
function lineWidth(text: string, fontSize: number, letterSpacing: number): number {
  let width = 0;
  for (const char of text) {
    width +=
      BREAKS_BETWEEN_CHARACTERS.test(char) || SMALL_KANA.test(char)
        ? fontSize + letterSpacing
        : extendaTextWidth(char, fontSize, letterSpacing);
  }
  return width;
}

/**
 * Nombre de lignes du titre, au moins celui du navigateur : chaque morceau sur
 * la ligne en cours s'il y tient, sur la suivante sinon, et coupé n'importe où
 * s'il est plus large qu'une ligne entière, comme `overflow-wrap: anywhere`.
 */
export function webTitleLines(title: string, size: TileSize): number {
  const typo = TILE_TYPO[size];
  const room =
    boxTileWidth(CASES_PAR_RANGEE[size]) - TILE.border * 2 - typo.padding * 2 - SMALL_SCREEN_SLACK;
  const fits = (text: string) => lineWidth(text, typo.title, typo.tracking) <= room;

  let lines = 0;
  let line = '';
  for (const chunk of titleChunks(title.trim().toLocaleUpperCase('fr-FR'))) {
    const candidate = line === '' ? chunk.text : line + chunk.before + chunk.text;
    if (fits(candidate)) {
      line = candidate;
      continue;
    }
    if (line !== '') lines += 1;
    line = '';
    for (const char of chunk.text) {
      if (line !== '' && !fits(line + char)) {
        lines += 1;
        line = '';
      }
      line += char;
    }
  }
  return line === '' ? lines : lines + 1;
}

/** Le titre dépassera ses deux lignes : la case pose le rognage du bas. */
export function webTitleClamped(title: string, size: TileSize): boolean {
  return webTitleLines(title, size) > 2;
}
