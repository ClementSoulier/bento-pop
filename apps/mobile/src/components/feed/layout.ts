import { GRID_HEIGHT, GRID_WIDTH } from '@/components/bento/geometry';

/**
 * Géométrie du fil « La table ». Pur, donc testable dans node.
 *
 * L'échelle se calcule sur la **largeur**, parce qu'un fil défile
 * verticalement : la largeur est la seule contrainte. C'est l'inverse du
 * composer, qui calcule sur la hauteur disponible parce qu'il tient en un
 * écran. Les deux sont corrects, la différence est notée ici pour qu'on ne
 * « corrige » pas l'un avec l'autre.
 */

/** Largeur de référence du design, 361 pt. */
export const DESIGN_WIDTH = GRID_WIDTH;

/** Hauteur de la boîte à l'échelle 1, 512 pt. */
export const DESIGN_HEIGHT = GRID_HEIGHT;

/**
 * Marge latérale de l'écran, de chaque côté.
 *
 * 32, contre 16 à l'origine. À 16, la boîte tombait pile à l'échelle 1 sur
 * un iPhone 15 (361 = 393 - 32), coïncidence élégante mais qui donnait des
 * posts collés aux bords : dans un fil, la boîte doit flotter sur le jaune,
 * pas le remplir. On perd la coïncidence, on gagne de l'air.
 */
export const H_PADDING = 32;

/**
 * Au-delà, sur tablette, la boîte s'étalerait jusqu'à des cases plus grandes
 * que l'écran d'un téléphone, et le fil perdrait son unité.
 */
export const MAX_BOX_WIDTH = 420;

/**
 * Plancher défensif. `useWindowDimensions` peut rendre 0 sur la toute
 * première frame de certaines plateformes, ce qui produirait une échelle
 * négative et une grille inversée.
 */
export const MIN_BOX_WIDTH = 240;

/**
 * Écart entre l'étiquette d'identité et **sa** boîte.
 *
 * Volontairement serré, et à lire avec `POST_GAP` : ce qui rattache un pseudo
 * à un bento, ce n'est pas la distance absolue mais le contraste entre les
 * deux écarts. 8 pt en dessous contre 72 au-dessus, soit un rapport de 9
 * pour 1, ne laisse aucun doute sur le lien. À 10 contre 44, le pseudo
 * paraissait appartenir au bento du dessus.
 */
export const HEADER_GAP = 8;

/**
 * Écart entre deux posts, donc entre une boîte et l'étiquette de la
 * suivante.
 *
 * 72, contre 28 à l'origine. L'ombre stamp de la boîte en mange 8, donc le
 * vide réellement perçu est de 66 pt, mesuré au pixel sur le rendu. Voir
 * `HEADER_GAP` : c'est le rapport entre les deux écarts qui fait qu'on
 * rattache le pseudo au bon bento.
 */
export const POST_GAP = 72;

/**
 * Débordement de l'étiquette « coup de cœur » sur le coin supérieur droit de
 * la boîte. Les valeurs sont négatives, donc l'étiquette sort du cadre ; la
 * place vient de `H_PADDING`, qui laisse 16 pt de chaque côté.
 */
export const RIBBON_OFFSET = { top: -8, right: -6 } as const;

/**
 * Barre d'actions (likes, commentaires) : rien en v1.
 *
 * Une rangée cœur / bulle grisée annoncerait une fonctionnalité inexistante
 * et récolterait des taps sans réponse. La constante existe pour que le
 * chantier 8 soit un changement de valeur et pas une reprise de la mise en
 * page.
 */
export const ACTIONS_HEIGHT = 0;

/** Largeur de la boîte pour une largeur de fenêtre donnée. */
export function feedBoxWidth(windowWidth: number): number {
  const available = windowWidth - H_PADDING * 2;
  return Math.max(MIN_BOX_WIDTH, Math.min(available, MAX_BOX_WIDTH));
}

/** Échelle à passer à `BentoGrid` pour une largeur de fenêtre donnée. */
export function feedScale(windowWidth: number): number {
  return feedBoxWidth(windowWidth) / DESIGN_WIDTH;
}

/**
 * Marge horizontale à appliquer de chaque côté d'un post.
 *
 * Vaut `H_PADDING` sur téléphone, et davantage sur grand écran, où la boîte
 * est plafonnée par `MAX_BOX_WIDTH` et doit rester centrée.
 *
 * **C'est une marge, pas une largeur plus un `alignSelf`.** La première
 * version posait `width` et `alignSelf: 'center'` sur le post : ça se rend
 * correctement sur `react-native-web`, et pas du tout sur iOS, où la cellule
 * de `FlatList` étire son enfant sur toute la largeur et écrase la
 * contrainte. Vérifié en build Release, donc hors de toute question de cache
 * de bundler. Une marge, elle, se soustrait de l'espace disponible avant
 * l'étirement : le résultat ne dépend plus de la façon dont le parent aligne
 * ses enfants.
 */
export function feedSideInset(windowWidth: number): number {
  // Plancher à 0 : sous `MIN_BOX_WIDTH`, la boîte est plus large que la
  // fenêtre et le calcul brut donnerait une marge négative, donc un
  // débordement. Le cas n'est atteignable que sur une largeur absurde (0 sur
  // la première frame de certaines plateformes), mais une marge négative se
  // rattrape mal une fois rendue.
  return Math.max(0, (windowWidth - feedBoxWidth(windowWidth)) / 2);
}
