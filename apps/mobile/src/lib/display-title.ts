/**
 * Titres display en Extenda : jamais un mot coupé, et des accents entiers.
 *
 * Deux défauts relevés au chantier 11, sur l'accueil et le composer :
 *
 * - **à la plus grande police**, un titre passait à la ligne au milieu d'un mot,
 *   « LES / RÈGLE / S », « COMPOS / E ». Un titre passe toujours à la ligne entre
 *   deux mots, comme à la taille par défaut, où « POP / CULTURE. » tient déjà sur
 *   deux lignes d'un iPhone 17 Pro. Mais quand un mot seul est plus large que la
 *   ligne, le titre rétrécit juste assez pour lui, cf. `displayTitleScale` ;
 * - **à la taille par défaut**, l'accent d'une capitale de la première ligne
 *   disparaissait : « LES REGLES », « UNE BOITE. » sur iOS, tronqué à plat sur
 *   Android. Extenda dessine ses accents au-dessus de son ascendante, que la
 *   boîte d'une ligne serrée ne contient pas, et le texte est rogné à sa boîte.
 *   Le titre réserve donc au-dessus de lui la hauteur d'un accent, en
 *   `paddingTop`, et la rend en `marginTop` négative : la mise en page ne bouge
 *   pas, seul le dessin gagne la place de ses accents.
 *
 * Aucun import de `react-native` : testé sous `node:test`.
 */

import { extendaTextWidth } from '@/components/bento/extenda-metrics';
import { TITLE_ROUNDING_SLACK } from '@/components/bento/tile-title';

/**
 * Facteur à appliquer à la police d'un titre pour que son mot le plus large
 * tienne dans `lineWidth`. Vaut 1 s'il y tient déjà : un titre qui tenait à la
 * taille par défaut ne bouge pas d'un point.
 *
 * Même mesure que les titres de case, `tileTitleScale` : largeur des glyphes
 * d'Extenda, sans crénage, espacement des lettres à part, et taille arrondie au
 * pixel supérieur sur Android (`pixelRatio`).
 */
export function displayTitleScale(
  title: string,
  lineWidth: number,
  fontSize: number,
  letterSpacing: number,
  pixelRatio?: number,
): number {
  if (lineWidth <= 0 || fontSize <= 0) return 1;
  const words = title.normalize('NFC').toUpperCase().split(/\s+/).filter(Boolean);
  const room = lineWidth - TITLE_ROUNDING_SLACK;
  const rendered = (size: number) =>
    pixelRatio === undefined ? size : Math.ceil(size * pixelRatio) / pixelRatio;
  let scale = 1;
  for (const word of words) {
    const spacing = letterSpacing * [...word].length;
    // Largeur des glyphes pour une police de 1, espacement à part.
    const glyphs = (extendaTextWidth(word, fontSize, letterSpacing) - spacing) / fontSize;
    if (glyphs * rendered(fontSize * scale) + spacing <= room) continue;
    const largest = (room - spacing) / glyphs;
    const size =
      pixelRatio === undefined ? largest : (Math.floor(largest * pixelRatio) - 0.01) / pixelRatio;
    scale = Math.min(scale, Math.max(0, size / fontSize));
  }
  return scale;
}

/**
 * Place réservée au-dessus d'une ligne d'Extenda pour les accents de ses
 * capitales, en em.
 *
 * Mesuré au lot 1 du chantier 11, au pixel, sur les titres de l'accueil à
 * l'interligne de 0,93 em : le circonflexe de « BOÎTE » dépasse la boîte de sa
 * ligne de 4,0 pt sur iPhone 17 Pro et de 3,2 dp sur Pixel 8, l'accent grave de
 * « RÈGLES » de 4,3 pt et de 3,1 dp, soit 0,10 à 0,15 em. Un quart d'em couvre
 * le plus haut avec de la marge, sans rien coûter : la réserve ne déplace rien.
 */
export const EXTENDA_ACCENT_ROOM_EM = 0.25;

/**
 * Diacritiques dessinés au-dessus de la lettre, une fois le texte décomposé :
 * grave, aigu, circonflexe, tilde, macron, brève, point, tréma, rond.
 * La cédille, dessinée dessous, n'en est pas.
 */
const ABOVE_MARKS = /[\u0300-\u030a]/;

/**
 * Place à réserver au-dessus d'un titre en Extenda pour les accents de sa
 * première ligne, à la taille rendue. Nulle quand elle n'en porte aucun :
 * « MON BENTO » ne bouge pas d'un point. La première ligne est comptée jusqu'au
 * premier saut de ligne : si elle passe elle-même à la ligne, la réserve est
 * seulement plus grande que nécessaire, sans effet sur la mise en page.
 */
export function extendaAccentRoom(title: string, renderedFontSize: number): number {
  const firstLine = title.split('\n')[0] ?? '';
  const hasAccent = ABOVE_MARKS.test(firstLine.toUpperCase().normalize('NFD'));
  return hasAccent ? Math.ceil(renderedFontSize * EXTENDA_ACCENT_ROOM_EM) : 0;
}
