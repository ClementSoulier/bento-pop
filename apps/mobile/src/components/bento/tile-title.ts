/**
 * Mise en lignes du titre d'une case, `Tile`, et du libellé d'une case vide.
 *
 * Un titre ne se coupe qu'entre deux mots, ou après un trait d'union. Trois
 * cas, mesurés sur les 27 bentos publiés (chantier 7, lot 3) :
 *
 * - un mot seul n'a aucune autre coupure : plus large que sa case, il se
 *   coupait au milieu sur les deux plateformes, « ARDÈCH / E » sur un iPhone
 *   17 Pro dès la taille de police xxLarge. Il reste sur une ligne, et
 *   rétrécit juste assez pour y tenir, mesuré comme le reste : cf.
 *   `tileTitleScale` ;
 * - plusieurs mots se répartissent sur deux lignes. Un premier mot plus large
 *   que la ligne s'y coupait pourtant, faute d'autre coupure avant lui :
 *   « KICKSTAR / T » sur iPhone, « KICK- / START » sur Android. Et ce qui ne
 *   tenait pas dans les deux lignes se tronquait : « JIMMY / PUNCHLI… »,
 *   « BOHEMIAN / RHAPSO… », 29 des 162 cases publiées. Le titre rétrécit donc
 *   jusqu'à tenir entier, sans descendre sous `TITLE_MIN_SCALE`, et toujours
 *   assez pour que son premier mot tienne : cf. `tileTitleScale` ;
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

/**
 * Le nombre de lignes d'un titre. **Jamais `adjustsFontSizeToFit`** : sa taille
 * se mesure, cf. `tileTitleScale`.
 *
 * Un mot seul le portait, et rétrécissait sous la main de la plateforme. Sur
 * iOS, combiné à la hauteur de ligne que la case pose, il réduisait le titre à
 * la trace : « TITANIC » écrit en 5 pt dans une case de 280, à chaque ouverture
 * à froid de la page publique, recette du chantier 13 le 16 septembre 2026.
 * Le piège est décrit dans `RECETTE-MOBILE.md`.
 */
export function tileTitleFit(title: string): TileTitleFit {
  const text = title.trim();
  const singleWord = !BREAKING_SPACE.test(text) && !BREAKS_BETWEEN_CHARACTERS.test(text);
  return { numberOfLines: singleWord ? 1 : 2, adjustsFontSizeToFit: false };
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
 * Plancher du rétrécissement d'un titre qui ne tient pas entier.
 *
 * En dessous, il se tronque comme avant. Mesuré sur les 162 cases publiées, fil
 * et page publique : 29 titres tronqués aujourd'hui, 13 encore à ce plancher, 3
 * seulement à 0,6, mais une case Chanson d'iPhone 17 Pro y écrirait en 7,2 pt.
 * Cf. §4.7 et D17 de la spécification du chantier 11.
 *
 * Sur Android, le plancher tombe lui aussi sur le pixel entier en dessous, par
 * la même règle d'arrondi : 0,73 pour une case de 13 pt sur un Pixel 8.
 */
export const TITLE_MIN_SCALE = 0.75;

/** Un morceau que la ligne ne peut pas couper, et ce qui le sépare du précédent. */
type Chunk = {
  text: string;
  /** Collé au morceau d'avant : la coupure vient d'un trait d'union, pas d'une espace. */
  glued: boolean;
};

/** Le titre découpé là où la ligne peut se couper. */
function titleChunks(text: string): Chunk[] {
  const chunks: Chunk[] = [];
  let current = '';
  let glued = false;
  for (const char of text) {
    if (BREAKING_SPACE.test(char)) {
      if (current) chunks.push({ text: current, glued });
      current = '';
      glued = false;
      continue;
    }
    current += char;
    if (BREAKING_HYPHEN.test(char)) {
      chunks.push({ text: current, glued });
      current = '';
      glued = true;
    }
  }
  if (current) chunks.push({ text: current, glued });
  return chunks;
}

/**
 * Les lignes que la plateforme composera : le morceau suivant tant qu'il tient
 * sur la ligne en cours, la ligne d'après sinon. Cette mise en lignes gloutonne
 * donne le plus petit nombre de lignes possible : si elle en compte deux, la
 * plateforme y arrivera aussi.
 */
function wrapTitle(
  chunks: readonly Chunk[],
  room: number,
  fontSize: number,
  letterSpacing: number,
): string[] {
  const lines: string[] = [];
  let line = '';
  for (const chunk of chunks) {
    const candidate =
      line === '' ? chunk.text : chunk.glued ? line + chunk.text : `${line} ${chunk.text}`;
    if (line === '' || extendaTextWidth(candidate, fontSize, letterSpacing) <= room) {
      line = candidate;
      continue;
    }
    lines.push(line);
    line = chunk.text;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Facteur à appliquer à une police pour qu'un texte tienne sur **une** ligne
 * de `lineWidth`, en capitales : 1 s'il y tient déjà. Sans plancher, c'est à
 * l'appelant d'en poser un.
 *
 * Même mesure que `tileTitleScale`, arrondi d'Android compris : c'est elle
 * qui dimensionne le titre d'une case d'un seul mot, et le titre du composer.
 */
export function lineFitScale(
  text: string,
  lineWidth: number,
  fontSize: number,
  letterSpacing: number,
  pixelRatio?: number,
): number {
  if (lineWidth <= 0 || fontSize <= 0) return 1;
  const upper = text.trim().normalize('NFC').toUpperCase();
  const room = lineWidth - TITLE_ROUNDING_SLACK;
  const rendered = (size: number) =>
    pixelRatio === undefined ? size : Math.ceil(size * pixelRatio) / pixelRatio;
  const snapped = (size: number) =>
    pixelRatio === undefined ? size : (Math.floor(size * pixelRatio) - 0.01) / pixelRatio;
  const spacing = letterSpacing * [...upper].length;
  // Largeur des glyphes pour une police de 1, espacement à part.
  const glyphs = (extendaTextWidth(upper, fontSize, letterSpacing) - spacing) / fontSize;
  if (glyphs * rendered(fontSize) + spacing <= room) return 1;
  return Math.max(0, snapped((room - spacing) / glyphs)) / fontSize;
}

/**
 * Facteur à appliquer à la police d'un titre de plusieurs mots pour qu'il
 * tienne entier en deux lignes de `lineWidth`, sans descendre sous
 * `TITLE_MIN_SCALE`, et pour que son premier mot y tienne quoi qu'il arrive.
 * Vaut 1 quand le titre tient déjà, et pour les écritures qui se coupent entre
 * deux caractères, qu'on ne mesure pas.
 *
 * Un mot seul n'a qu'une ligne : il rétrécit autant qu'il le faut pour la
 * remplir au plus, sans plancher, comme le faisait `adjustsFontSizeToFit`.
 *
 * Les deux conditions ne pèsent pas pareil. Un premier mot trop large se
 * **coupe au milieu**, faute de coupure avant lui, « KICKSTAR / T » : le titre
 * rétrécit alors autant qu'il le faut, plancher compris, une case ne montrant
 * pas un mot cassé. Un mot trop large en dernière ligne, lui, se **tronque**,
 * « BOHEMIAN / RHAPSO… » : le titre rétrécit jusqu'au plancher, et s'y arrête.
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
  const measured = lineWidth > 0 && fontSize > 0 && !BREAKS_BETWEEN_CHARACTERS.test(text);
  if (!measured) return 1;

  const upper = text.normalize('NFC').toUpperCase();
  const room = lineWidth - TITLE_ROUNDING_SLACK;
  /** La police telle que la plateforme la dessinera. */
  const rendered = (size: number) =>
    pixelRatio === undefined ? size : Math.ceil(size * pixelRatio) / pixelRatio;
  /** Le pixel entier en dessous, moins un centième que l'arrondi rattrape. */
  const snapped = (size: number) =>
    pixelRatio === undefined ? size : (Math.floor(size * pixelRatio) - 0.01) / pixelRatio;
  /** La taille à laquelle ce texte tient sur une ligne : `fontSize` s'il y tient déjà. */
  const lineSize = (line: string) =>
    fontSize * lineFitScale(line, lineWidth, fontSize, letterSpacing, pixelRatio);

  // Un mot seul : sa ligne entière, traits d'union et insécables compris.
  if (tileTitleFit(text).numberOfLines === 1) return lineSize(upper) / fontSize;

  // 1. La taille à laquelle le premier mot tient sur sa ligne.
  const wordSize = lineSize(firstUnbreakable(upper));

  // 2. La plus grande taille, sous celle-là, à laquelle le titre tient entier.
  const chunks = titleChunks(upper);
  const fitsWhole = (size: number) => {
    const drawn = rendered(size);
    const lines = wrapTitle(chunks, room, drawn, letterSpacing);
    return (
      lines.length <= 2 && lines.every((l) => extendaTextWidth(l, drawn, letterSpacing) <= room)
    );
  };
  const floor = fontSize * TITLE_MIN_SCALE;
  if (wordSize <= floor || fitsWhole(wordSize)) return wordSize / fontSize;
  if (!fitsWhole(snapped(floor))) return snapped(floor) / fontSize;

  let fits = floor;
  let over = wordSize;
  // Vingt-quatre pas : la fourchette de départ vaut un quart de la police, et
  // il en reste moins d'un millionième de point.
  for (let step = 0; step < 24; step++) {
    const middle = (fits + over) / 2;
    if (fitsWhole(snapped(middle))) fits = middle;
    else over = middle;
  }
  return snapped(fits) / fontSize;
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
