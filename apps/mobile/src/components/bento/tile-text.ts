/**
 * Mise en page du texte d'une case, `Tile` : ses tailles, ses hauteurs de
 * ligne, et la place qui reste entre l'étiquette en haut et le titre en bas.
 * Puis celle d'une case vide, `EmptyTile`, plus bas.
 *
 * Une case a la hauteur que la grille lui donne. L'étiquette y est posée en
 * haut, le titre et le sous-titre en bas : s'ils grossissent trop, ils se
 * chevauchent. C'est arrivé sur l'émulateur Android à la taille de police 2,0
 * (chantier 7, lot 3) : l'étiquette « SON » recouvrait « MERRY- », parce que
 * Bungee y occupait 25,5 dp de haut pour 9,6 de police, et le sous-titre
 * japonais 17 dp pour 10,8. Les hauteurs de ligne naturelles changent d'une
 * police, d'une écriture et d'une plateforme à l'autre ; posées ici, elles
 * sont les mêmes partout, et la place qui reste se calcule.
 *
 * Aucun import de `react-native` : testé sous `node:test`.
 */

import {
  QUESTION_LABEL_MAX_LINES,
  QUESTION_LABEL_MIN_FONT,
  bungeeTextWidth,
  fitLabel,
  wrapWords,
} from '@bento-pop/supabase-mobile/bento';
import { TILE_MAX_FONT_MULTIPLIER, fontScaleFor } from './font-scaling';

export type TileSize = 'sm' | 'md' | 'lg';

/**
 * Config par taille. `letterSpacing` positif pour aérer la police Extenda
 * Yotta dont le crénage natif est très serré ; sans ça les lettres se
 * touchent (« SEVERANCE », « ORELSAN » illisibles).
 * `initial` = taille de la grosse initiale du fallback visuel (rendue en
 * filigrane derrière le gradient quand pas de photo).
 */
export const TILE_SIZE_CONF: Record<
  TileSize,
  { title: number; sub: number; pad: number; stamp: number; letterSpacing: number; initial: number }
> = {
  lg: { title: 28, sub: 13, pad: 16, stamp: 9, letterSpacing: 1.2, initial: 140 },
  md: { title: 17, sub: 11, pad: 12, stamp: 9, letterSpacing: 0.8, initial: 96 },
  sm: { title: 13, sub: 9.5, pad: 9, stamp: 8, letterSpacing: 0.5, initial: 68 },
};

/** Bordure d'une case, dans laquelle s'inscrivent l'étiquette et le titre. */
export const TILE_BORDER = 2.5;

/**
 * Hauteurs de ligne, en fraction de la taille de police de chaque texte.
 *
 * `emptyLabel`, le libellé d'une case vide, garde la hauteur naturelle de
 * Bungee sur iOS (1 020 + 300 sur 1 000), mesurée à 10,5 pt pour 8 pt sur un
 * iPhone SE : la case vide y reste identique à la taille par défaut. Android
 * y ajoutait une marge de police de 1,23 em, qui disparaît.
 */
export const TILE_LINE = { stamp: 1.25, title: 1, subtitle: 1.3, emptyLabel: 1.32 } as const;

/** Marge verticale du fond de l'étiquette, au-dessus et au-dessous du texte. */
export const TILE_STAMP_PADDING_V = 2;

/** Marge horizontale du fond de l'étiquette, de chaque côté du texte. */
export const TILE_STAMP_PADDING_H = 6;

/**
 * La même marge, pour la question d'une édition : 4 et non 6.
 *
 * Une question tient sur deux lignes dans une case large de 85 points, sur
 * la page publique d'un iPhone SE ou d'un 17 Pro. Là, 4 points de texte en
 * plus font la différence entre « TON VOYAGE / RÊVÉ » et « TON / VOYAG… »,
 * vu à la première capture de la proposition A. Le tampon du bento principal
 * garde sa marge : il ne change pas d'un pixel.
 */
export const TILE_QUESTION_PADDING_H = 4;

/** Plancher de l'étiquette, le même que celui de `tileConf` : jamais sous 7 points. */
export const TILE_LABEL_MIN_FONT = QUESTION_LABEL_MIN_FONT;

/** Espacement des lettres de l'étiquette. */
export const TILE_STAMP_LETTER_SPACING = 1;

/**
 * Lignes au plus d'une étiquette. Une seule pour un tampon, « FILM » ; deux
 * pour la question d'une édition, cf. `filledCaseLabel`.
 */
export const TILE_LABEL_MAX_LINES = QUESTION_LABEL_MAX_LINES;

/**
 * Largeur offerte au texte de l'étiquette dans une case de `tileWidth`, cadre
 * compris : la case moins sa bordure, ses marges et celles du fond noir.
 */
export function tileLabelTextWidth(
  tileWidth: number,
  pad: number,
  paddingH: number = TILE_STAMP_PADDING_H,
): number {
  return Math.max(0, tileWidth - TILE_BORDER * 2 - pad * 2 - paddingH * 2);
}

/**
 * Taille de la question d'une édition : `fontSize`, ou juste assez moins pour
 * tenir en `TILE_LABEL_MAX_LINES` lignes, sans descendre sous
 * `TILE_LABEL_MIN_FONT`. Sous ce plancher, elle se tronque.
 *
 * Même règle que les titres, `tileTitleScale` : mesurée et non confiée à la
 * plateforme, et arrondie comme Android l'arrondit quand `pixelRatio` est
 * donné. Le plancher est **en points** : agrandie par la police système, une
 * question peut redescendre vers sa taille normale au lieu de se tronquer.
 *
 * Garantie, vérifiée par `question-label.test.ts` : toute question que le
 * back-office accepte s'affiche entière sur les téléphones mesurés, composer,
 * fil et page publique, à toute taille de police.
 */
export function tileLabelFontSize(
  label: string,
  textWidth: number,
  fontSize: number,
  pixelRatio?: number,
): number {
  return fitLabel(label, textWidth, fontSize, {
    measure: (line, size) => bungeeTextWidth(line, size, TILE_STAMP_LETTER_SPACING),
    minFontSize: TILE_LABEL_MIN_FONT,
    maxLines: TILE_LABEL_MAX_LINES,
    pixelRatio,
  }).fontSize;
}

/**
 * Lignes que prend l'étiquette, coupée entre les mots comme la plateforme la
 * coupe, et mesurée sur les largeurs de Bungee en capitales.
 *
 * Plafonnée par l'appelant à `TILE_LABEL_MAX_LINES` : au-delà, le texte se
 * tronque, et c'est au back-office de refuser une question qui ne tiendrait
 * pas.
 */
/**
 * La question d'une édition, prête à dessiner : sa taille, ses lignes, et la
 * largeur de sa plus longue ligne, mesurées à la taille que la plateforme
 * dessinera. Tronquée au plancher, elle prend toute la largeur permise.
 */
export function tileLabelFit(
  label: string,
  textWidth: number,
  fontSize: number,
  pixelRatio?: number,
): { fontSize: number; lines: number; widest: number } {
  const fit = fitLabel(label, textWidth, fontSize, {
    measure: (line, size) => bungeeTextWidth(line, size, TILE_STAMP_LETTER_SPACING),
    minFontSize: TILE_LABEL_MIN_FONT,
    maxLines: TILE_LABEL_MAX_LINES,
    pixelRatio,
  });
  return {
    fontSize: fit.fontSize,
    lines: Math.max(1, Math.min(TILE_LABEL_MAX_LINES, fit.lines.length)),
    widest: fit.truncated ? textWidth : Math.min(textWidth > 0 ? textWidth : Infinity, fit.widest),
  };
}

export function tileLabelLines(label: string, textWidth: number, fontSize: number): number {
  return tileLabelWrap(label, textWidth, fontSize).lines;
}

/**
 * La mise en lignes de l'étiquette : combien de lignes, et la largeur de la
 * plus longue.
 *
 * La seconde sert à dessiner le fond noir. Un texte qui passe à la ligne
 * prend toute la largeur permise, et le fond avec lui : « TON VOYAGE / RÊVÉ »
 * posait une dalle noire sur toute la case, à la première capture de la
 * proposition A. Le fond prend la largeur de la plus longue ligne.
 */
export function tileLabelWrap(
  label: string,
  textWidth: number,
  fontSize: number,
): { lines: number; widest: number } {
  const largeur = (texte: string) => bungeeTextWidth(texte, fontSize, TILE_STAMP_LETTER_SPACING);
  const texte = label.trim().toUpperCase();
  if (!texte) return { lines: 1, widest: 0 };
  if (textWidth <= 0) return { lines: 1, widest: largeur(texte) };
  const lignes = wrapWords(texte, textWidth, largeur);
  return { lines: lignes.length, widest: Math.max(...lignes.map(largeur)) };
}

/** Écart entre le titre et le sous-titre. */
export const TILE_SUBTITLE_GAP = 4;

/**
 * Place laissée au minimum entre l'étiquette et le titre, selon le calcul.
 *
 * 4 et non 2 : sur l'émulateur Android, un titre de deux lignes a mesuré
 * jusqu'à 3,2 dp de plus que le calcul (« MERRY-GO-ROUND OF LIFE », 32 dp pour
 * 28,8), 1,2 pour « GAME OF THRONES ». La cause n'est pas établie ; la marge
 * la couvre, et laisse inchangée la taille par défaut, dont la place la plus
 * serrée vaut 4,1 dans le composer.
 */
export const TILE_MIN_CLEARANCE = 4;

/**
 * Paramètres de mise en page d'une case à l'échelle de la grille.
 *
 * Le `letterSpacing` reste constant (déjà serré). Plancher à 0.7 pour ne pas
 * avoir d'étiquettes illisibles sur petit écran.
 */
export function tileConf(size: TileSize, scale: number) {
  const base = TILE_SIZE_CONF[size];
  const s = Math.max(0.7, scale);
  return {
    title: Math.round(base.title * s),
    sub: Math.round(base.sub * s),
    pad: Math.round(base.pad * s),
    stamp: Math.max(7, Math.round(base.stamp * s)),
    letterSpacing: base.letterSpacing,
    initial: Math.round(base.initial * s),
  };
}

/**
 * Place libre entre le bas de l'étiquette et le haut du titre, dans le pire
 * cas : un titre sur deux lignes et un sous-titre. Négative, ils se
 * chevauchent.
 *
 * `textScale` est le facteur de police que la case applique, déjà plafonné,
 * cf. `fontScaleFor`.
 */
export function tileTextClearance(
  height: number,
  size: TileSize,
  scale: number,
  textScale: number,
  options: TileTextOptions = {},
): number {
  const { fixed, perTextScale } = clearanceTerms(height, size, scale, options);
  return fixed - perTextScale * textScale;
}

/** Ce qui change la place du texte d'une case, en plus de sa taille. */
export type TileTextOptions = {
  /** Lignes de l'étiquette, 1 par défaut. Deux pour une question d'édition. */
  stampLines?: number;
  /** Le sous-titre est-il affiché ? Oui par défaut. */
  subtitle?: boolean;
};

/** La place libre est affine en `textScale` : ce qui ne grossit pas, moins ce qui grossit. */
function clearanceTerms(
  height: number,
  size: TileSize,
  scale: number,
  { stampLines = 1, subtitle = true }: TileTextOptions = {},
) {
  const conf = tileConf(size, scale);
  return {
    fixed:
      height -
      TILE_BORDER * 2 -
      conf.pad * 2 -
      TILE_STAMP_PADDING_V * 2 -
      (subtitle ? TILE_SUBTITLE_GAP : 0),
    perTextScale:
      conf.stamp * TILE_LINE.stamp * stampLines +
      conf.title * TILE_LINE.title * 2 +
      (subtitle ? conf.sub * TILE_LINE.subtitle : 0),
  };
}

/**
 * Facteur de police qu'une case applique à son étiquette, son titre et son
 * sous-titre : la taille système jusqu'au plafond des cases, et jamais
 * au-delà de ce que sa hauteur permet.
 *
 * Le plafond seul ne tient pas partout. À 1,2, il laisse 7,8 pt dans une
 * petite case du fil sur un iPhone SE, mais chevaucherait de 1 pt dans celle
 * du composer, dont l'échelle descend à 0,67 sur le même téléphone. Là, le
 * texte grossit un peu moins, juste assez pour laisser `TILE_MIN_CLEARANCE`.
 */
export function tileTextScale(
  height: number,
  size: TileSize,
  scale: number,
  fontScale: number,
  options: TileTextOptions = {},
): number {
  const wanted = fontScaleFor(fontScale, TILE_MAX_FONT_MULTIPLIER);
  const { fixed, perTextScale } = clearanceTerms(height, size, scale, options);
  const fits = (fixed - TILE_MIN_CLEARANCE) / perTextScale;
  return Math.max(0, Math.min(wanted, fits));
}

/**
 * Le texte d'une case : son facteur de police, et si le sous-titre s'affiche.
 *
 * Une étiquette sur une ligne, celle du bento principal, rend exactement
 * `tileTextScale` avec le sous-titre : rien ne change pour lui.
 *
 * Une question d'édition sur deux lignes prend la hauteur d'une ligne de
 * plus. Là où elle ferait rétrécir le texte, **le sous-titre s'efface
 * d'abord** : l'année d'un film compte moins que la question à laquelle il
 * répond, et un titre rétréci se lit moins bien qu'un sous-titre absent.
 */
export function tileTextLayout(
  height: number,
  size: TileSize,
  scale: number,
  fontScale: number,
  stampLines = 1,
): { textScale: number; subtitle: boolean } {
  const avec = tileTextScale(height, size, scale, fontScale, { stampLines });
  if (stampLines < 2 || avec >= fontScaleFor(fontScale, TILE_MAX_FONT_MULTIPLIER)) {
    return { textScale: avec, subtitle: true };
  }
  const sans = tileTextScale(height, size, scale, fontScale, { stampLines, subtitle: false });
  return sans > avec ? { textScale: sans, subtitle: false } : { textScale: avec, subtitle: true };
}

/*
 * Case vide, `EmptyTile` : le cercle « + » du composer et le libellé de la
 * catégorie, centrés dans une bordure pointillée.
 *
 * Le libellé ne peut pas plus faire grandir la case que le titre d'une case
 * remplie. Sur l'émulateur Android, dès la taille de police 1,3, « CRÉATEUR DE
 * CONTENU » y passait sur trois lignes, et le groupe centré débordait des deux
 * côtés : le cercle sortait du pointillé en haut, le libellé le touchait en bas
 * (chantier 7, lot 3). Le libellé tient donc sur deux lignes au plus, cf.
 * `emptyTileLabelFit`, et grossit moins là où la case est trop basse pour elles.
 */

/** Bordure pointillée d'une case vide. */
export const EMPTY_TILE_BORDER = 2;

/**
 * Marge intérieure d'une case vide. Le groupe centré peut y déborder sans que
 * rien ne se voie : c'est déjà le cas à la taille par défaut dans le composer
 * d'un iPhone SE, où il mesure 50,3 pt pour 45,4 de place.
 */
export const EMPTY_TILE_PADDING = 8;

/** Place laissée au minimum entre le pointillé et le contenu, en haut comme en bas. */
export const EMPTY_TILE_MIN_INSET = 4;

/** Paramètres d'une case vide à l'échelle de la grille, plancher à 0,7 comme `tileConf`. */
export function emptyTileConf(scale: number) {
  const s = Math.max(0.7, scale);
  return {
    circle: Math.round(36 * s),
    plus: Math.round(20 * s),
    label: Math.max(8, Math.round(10 * s)),
    gap: 6 * s,
  };
}

export type EmptyTileContent = {
  /** Lignes du libellé, cf. `emptyTileLabelFit`. */
  lines: number;
  /** Le cercle « + » du composer ; la consultation n'a que le libellé. */
  withCircle: boolean;
};

/**
 * Place libre entre le pointillé et le contenu centré, de chaque côté.
 * Négative, le contenu sort de la case.
 *
 * `labelScale` est le facteur de police que la case applique à son libellé,
 * déjà plafonné, cf. `fontScaleFor`.
 */
export function emptyTileClearance(
  height: number,
  scale: number,
  labelScale: number,
  content: EmptyTileContent,
): number {
  const { fixed, perLabelScale } = emptyTileTerms(height, scale, content);
  return (fixed - perLabelScale * labelScale) / 2;
}

function emptyTileTerms(height: number, scale: number, { lines, withCircle }: EmptyTileContent) {
  const conf = emptyTileConf(scale);
  return {
    fixed: height - EMPTY_TILE_BORDER * 2 - (withCircle ? conf.circle + conf.gap : 0),
    perLabelScale: lines * conf.label * TILE_LINE.emptyLabel,
  };
}

/**
 * Facteur de police qu'une case vide applique à son libellé : la taille
 * système jusqu'au plafond des cases, et jamais au-delà de ce que sa hauteur
 * permet. Le composer d'un iPhone SE, à l'échelle 0,65, n'atteint pas le
 * plafond pour deux lignes.
 */
export function emptyTileLabelScale(
  height: number,
  scale: number,
  fontScale: number,
  content: EmptyTileContent,
): number {
  const wanted = fontScaleFor(fontScale, TILE_MAX_FONT_MULTIPLIER);
  const { fixed, perLabelScale } = emptyTileTerms(height, scale, content);
  const fits = (fixed - EMPTY_TILE_MIN_INSET * 2) / perLabelScale;
  return Math.max(0, Math.min(wanted, fits));
}
