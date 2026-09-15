import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import * as ts from 'typescript';
import { fontScaleFor } from './font-scaling';

/**
 * Les plafonds de police système, lus dans le code source.
 *
 * Un plafond oublié ne casse rien à la taille par défaut : il ne se voit qu'à
 * la plus grande police, sur un réglage que personne n'a pendant le
 * développement. Et le modèle de la page publique ne tient que si l'écran pose
 * les plafonds qu'il suppose et garde sur une ligne ce qu'il compte pour une
 * ligne (`public-layout.ts`). Rien, à l'exécution, ne signale un écart.
 *
 * Ces tests lisent donc l'arbre syntaxique des fichiers, comme le ferait une
 * règle de lint, et échouent avec le numéro de ligne du texte en faute.
 */

const APP_ROOT = join(__dirname, '..', '..', '..');

type Tag = {
  line: number;
  /** Nom de l'attribut → source de sa valeur, `true` pour un attribut sans valeur. */
  attributes: Map<string, string | true>;
  /** Source du style, constantes qu'il nomme résolues de proche en proche. */
  styleSource: string;
};

function parse(relativePath: string): ts.SourceFile {
  const text = readFileSync(join(APP_ROOT, relativePath), 'utf8');
  return ts.createSourceFile(relativePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function attributesOf(node: ts.JsxOpeningLikeElement): Map<string, string | true> {
  const attributes = new Map<string, string | true>();
  for (const attribute of node.attributes.properties) {
    if (!ts.isJsxAttribute(attribute)) continue;
    const name = attribute.name.getText();
    const value = attribute.initializer;
    if (!value) attributes.set(name, true);
    else if (ts.isStringLiteral(value)) attributes.set(name, value.text);
    else if (ts.isJsxExpression(value) && value.expression) {
      attributes.set(name, value.expression.getText());
    }
  }
  return attributes;
}

/**
 * La source d'une valeur de style, et celle des constantes qu'elle nomme, de
 * proche en proche : `style={[dateStyle, …]}` renvoie à `const dateStyle`, qui
 * renvoie à `const textScale = fontScaleFor(…)`, déclarés dans le composant.
 */
function resolvedSource(expression: ts.Expression, from: ts.Node): string {
  let scope: ts.Node | undefined = from.parent;
  while (scope && !ts.isFunctionLike(scope)) scope = scope.parent;
  const declarations = new Map<string, ts.Expression>();
  const collect = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      declarations.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, collect);
  };
  if (scope) collect(scope);

  const parts = [expression.getText()];
  const resolved = new Set<string>();
  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node) && !resolved.has(node.text)) {
      const declared = declarations.get(node.text);
      if (declared) {
        resolved.add(node.text);
        parts.push(declared.getText());
        visit(declared);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(expression);
  return parts.join('\n');
}

function tagsNamed(file: ts.SourceFile, tagName: string): Tag[] {
  const tags: Tag[] = [];
  const visit = (node: ts.Node) => {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText() === tagName
    ) {
      const style = node.attributes.properties.find(
        (a): a is ts.JsxAttribute => ts.isJsxAttribute(a) && a.name.getText() === 'style',
      );
      const expression =
        style?.initializer && ts.isJsxExpression(style.initializer)
          ? style.initializer.expression
          : undefined;
      tags.push({
        line: file.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        attributes: attributesOf(node),
        styleSource: expression ? resolvedSource(expression, node) : '',
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return tags;
}

function linesOf(tags: Tag[]): string {
  return tags.map((tag) => `ligne ${tag.line}`).join(', ');
}

const fixed = (t: Tag) => t.attributes.get('allowFontScaling') === 'false';

/**
 * Un texte qui pose sa hauteur de ligne ne peut pas laisser React Native
 * l'agrandir : sur Android, elle n'y est pas plafonnée, et suit la courbe non
 * linéaire d'Android 14. Il passe `allowFontScaling={false}`, cf.
 * `fontScaleFor`.
 */
function lineHeightsLeftToPlatform(texts: Tag[]): Tag[] {
  return texts.filter((t) => /\blineHeight\b/.test(t.styleSource) && !fixed(t));
}

/** Les plafonds passés à `fontScaleFor` dans la source d'un style. */
function capsOf(t: Tag): string[] {
  return [...t.styleSource.matchAll(/\bfontScaleFor\(\s*fontScale\s*,\s*([^)\s]+)\s*\)/g)].map(
    (m) => m[1] ?? '',
  );
}

const SCREEN = 'app/u/[pseudo].tsx';
const TILE = 'src/components/bento/Tile.tsx';
const EMPTY_TILE = 'src/components/bento/EmptyTile.tsx';
const GRID = 'src/components/bento/BentoGrid.tsx';
const SHARE_IMAGE = 'src/components/bento/ShareImage.tsx';

describe('fontScaleFor', () => {
  it('suit la taille système jusqu’au plafond, puis s’y arrête', () => {
    assert.equal(fontScaleFor(1, 1.4), 1);
    assert.equal(fontScaleFor(1.235, 1.4), 1.235);
    assert.equal(fontScaleFor(3.571, 1.4), 1.4);
    assert.equal(fontScaleFor(2, 1.2), 1.2);
  });

  it('suit aussi une taille plus petite que le défaut', () => {
    assert.equal(fontScaleFor(0.823, 1.2), 0.823);
  });

  it('lit une taille absurde comme la taille par défaut', () => {
    for (const fontScale of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.equal(fontScaleFor(fontScale, 1.4), 1, String(fontScale));
    }
  });
});

describe('page publique, textes de l’écran', () => {
  const texts = tagsNamed(parse(SCREEN), 'Text');

  it('trouve les textes de l’écran', () => {
    // Chevron, pseudo, date et son os, pastille, deux boutons, trois textes
    // d'état, « Options » : un seuil qui empêche le test de passer à vide.
    assert.ok(texts.length >= 11, `${texts.length} textes`);
  });

  it('plafonne chaque texte, ou lui applique la police lui-même', () => {
    const uncapped = texts.filter((t) => !t.attributes.has('maxFontSizeMultiplier') && !fixed(t));
    assert.equal(uncapped.length, 0, `sans plafond : ${linesOf(uncapped)}`);
  });

  it('ne laisse jamais la plateforme agrandir une hauteur de ligne', () => {
    const wrong = lineHeightsLeftToPlatform(texts);
    assert.equal(wrong.length, 0, `hauteur de ligne laissée à la plateforme : ${linesOf(wrong)}`);
  });

  it('prend ses plafonds dans le modèle, jamais en nombres recopiés', () => {
    const allowed = new Set(['CONTENT_MAX_FONT_MULTIPLIER', 'BUTTON_MAX_FONT_MULTIPLIER']);
    const copied = texts.filter((t) => {
      const cap = t.attributes.get('maxFontSizeMultiplier');
      return (
        (typeof cap === 'string' && !allowed.has(cap)) || capsOf(t).some((c) => !allowed.has(c))
      );
    });
    assert.equal(copied.length, 0, `plafond recopié : ${linesOf(copied)}`);
  });

  it('garde sur une ligne, au plafond du modèle, chaque ligne que le modèle compte', () => {
    const header = texts.filter((t) => /\b(PSEUDO_LINE_H|DATE_LINE_H)\b/.test(t.styleSource));
    const buttons = texts.filter((t) => /\bCTA_LABEL_LINE_H\b/.test(t.styleSource));
    // Le pseudo, la date et son os de chargement ; les deux libellés de boutons.
    assert.equal(header.length, 3, `en-tête : ${linesOf(header)}`);
    assert.equal(buttons.length, 2, `boutons : ${linesOf(buttons)}`);

    const multiline = [...header, ...buttons].filter(
      (t) =>
        t.attributes.get('numberOfLines') !== '1' ||
        t.attributes.get('adjustsFontSizeToFit') !== true,
    );
    assert.equal(multiline.length, 0, `peut passer à la ligne : ${linesOf(multiline)}`);

    const wrongHeader = header.filter(
      (t) => !fixed(t) || capsOf(t).join() !== 'CONTENT_MAX_FONT_MULTIPLIER',
    );
    const wrongButtons = buttons.filter(
      (t) => !fixed(t) || capsOf(t).join() !== 'BUTTON_MAX_FONT_MULTIPLIER',
    );
    assert.equal(wrongHeader.length, 0, `en-tête mal plafonné : ${linesOf(wrongHeader)}`);
    assert.equal(wrongButtons.length, 0, `bouton mal plafonné : ${linesOf(wrongButtons)}`);
  });

  /**
   * Le conteneur du libellé « Partager » avait la hauteur de la ligne à la
   * taille par défaut : dès que la police grossissait, le libellé
   * rétrécissait jusqu'à un trait pour y tenir.
   */
  it('donne au conteneur d’un libellé la hauteur plafonnée du modèle, jamais figée', () => {
    const views = tagsNamed(parse(SCREEN), 'View');
    const following = views.filter((v) => /\bpublicCtaLabelHeight\(/.test(v.styleSource));
    const frozen = views.filter((v) => /\bCTA_LABEL_LINE_H\b/.test(v.styleSource));
    assert.equal(following.length, 1, `conteneurs : ${linesOf(following)}`);
    assert.equal(frozen.length, 0, `hauteur figée : ${linesOf(frozen)}`);
  });
});

describe('cases du bento', () => {
  const tileTexts = tagsNamed(parse(TILE), 'Text');
  const emptyTileTexts = tagsNamed(parse(EMPTY_TILE), 'Text');

  it('trouve les textes des cases', () => {
    assert.ok(tileTexts.length >= 6, `Tile : ${tileTexts.length} textes`);
    assert.ok(emptyTileTexts.length >= 3, `EmptyTile : ${emptyTileTexts.length} textes`);
  });

  it('plafonne chaque texte au plafond des cases et le laisse figer par la grille', () => {
    const wrong = [...tileTexts, ...emptyTileTexts].filter(
      (t) =>
        !fixed(t) &&
        (t.attributes.get('allowFontScaling') !== 'allowFontScaling' ||
          t.attributes.get('maxFontSizeMultiplier') !== 'TILE_MAX_FONT_MULTIPLIER'),
    );
    assert.equal(wrong.length, 0, `mal plafonné : ${linesOf(wrong)}`);
  });

  it('ne laisse jamais la plateforme agrandir une hauteur de ligne', () => {
    const wrong = lineHeightsLeftToPlatform([...tileTexts, ...emptyTileTexts]);
    assert.equal(wrong.length, 0, `hauteur de ligne laissée à la plateforme : ${linesOf(wrong)}`);
  });

  /**
   * L'étiquette, « En attente », le titre et le sous-titre : les textes dont
   * la hauteur décide de la place restante dans la case, cf. `tile-text.ts`.
   */
  it('applique à ses textes la police que la case permet, figée quand la grille le demande', () => {
    const scaled = tileTexts.filter((t) => /\btextScale\b/.test(t.styleSource));
    assert.equal(scaled.length, 4, `textes à l’échelle de la case : ${linesOf(scaled)}`);
    const wrong = scaled.filter(
      (t) =>
        !fixed(t) ||
        !/\btileTextScale\(/.test(t.styleSource) ||
        !/\ballowFontScaling\s*\?/.test(t.styleSource) ||
        !/\blineHeight\b/.test(t.styleSource),
    );
    assert.equal(wrong.length, 0, `mal mis à l’échelle : ${linesOf(wrong)}`);
  });

  /**
   * Le libellé d'une case vide, composer et consultation : sa hauteur décide
   * de la place autour du cercle, cf. `emptyTileLabelScale`.
   */
  it('applique au libellé d’une case vide la police que la case permet, sur deux lignes au plus', () => {
    const labels = emptyTileTexts.filter((t) => /\blabelScale\b/.test(t.styleSource));
    assert.equal(labels.length, 2, `libellés : ${linesOf(labels)}`);
    const wrong = labels.filter(
      (t) =>
        !fixed(t) ||
        !/\bemptyTileLabelScale\(/.test(t.styleSource) ||
        !/\ballowFontScaling\s*\?/.test(t.styleSource) ||
        !/\blineHeight\b/.test(t.styleSource) ||
        t.attributes.get('numberOfLines') !== 'labelFit.numberOfLines' ||
        t.attributes.get('adjustsFontSizeToFit') !== 'labelFit.adjustsFontSizeToFit',
    );
    assert.equal(wrong.length, 0, `mal mis à l’échelle : ${linesOf(wrong)}`);
  });

  it('ne coupe jamais un titre au milieu d’un mot', () => {
    const [title] = tileTexts.filter((t) => /\bconf\.title\b/.test(t.styleSource));
    // Un mot seul sur une ligne qui rétrécit, plusieurs mots sur deux : cf. `tile-title.ts`.
    assert.equal(title?.attributes.get('numberOfLines'), 'titleFit.numberOfLines');
    assert.equal(title?.attributes.get('adjustsFontSizeToFit'), 'titleFit.adjustsFontSizeToFit');
    // Et un premier mot trop large fait rétrécir le titre, dans la largeur de la case,
    // à la police qu'Android arrondit au pixel.
    assert.match(title?.styleSource ?? '', /\btileTitleScale\([^)]*\bwidth\b/);
    assert.match(title?.styleSource ?? '', /Platform\.OS === 'android' \? PixelRatio\.get\(\)/);
    // Android : coupure entre les mots et après un trait d'union seulement.
    assert.equal(title?.attributes.get('textBreakStrategy'), 'simple');
    assert.equal(title?.attributes.get('android_hyphenationFrequency'), 'normal');
  });

  it('reçoit de la grille la largeur de chaque case', () => {
    const [tile] = tagsNamed(parse(GRID), 'Tile');
    assert.match(String(tile?.attributes.get('width')), /\bgridTileWidth\(/);
  });

  /**
   * Sans largeur, un titre ne mesure rien et son premier mot se coupe : seule
   * une grille vide, qui n'a pas de titre, peut s'en passer.
   */
  it('donne à chaque grille de l’app la largeur de sa boîte', () => {
    const files = readdirSync(APP_ROOT, { recursive: true, encoding: 'utf8' }).filter(
      (path) =>
        /^(app|src)\//.test(path) && path.endsWith('.tsx') && !path.includes('node_modules'),
    );
    const grids = files.flatMap((path) =>
      tagsNamed(parse(path), 'BentoGrid').map((tag) => ({ path, tag })),
    );
    // Page publique, fil, composer, image de partage, écran de mécanique.
    assert.equal(grids.length, 5, grids.map(({ path }) => path).join(', '));
    const missing = grids.filter(
      ({ tag }) => !tag.attributes.has('empty') && !tag.attributes.has('width'),
    );
    assert.deepEqual(
      missing.map(({ path, tag }) => `${path}, ligne ${tag.line}`),
      [],
    );
  });

  it('reçoit de la grille le réglage de police, case remplie comme case vide', () => {
    const grid = parse(GRID);
    for (const tag of ['Tile', 'EmptyTile']) {
      const [element, ...others] = tagsNamed(grid, tag);
      assert.equal(others.length, 0, `un seul ${tag}`);
      assert.equal(element?.attributes.get('allowFontScaling'), 'allowFontScaling', tag);
    }
  });
});

describe('image de partage', () => {
  const file = parse(SHARE_IMAGE);

  it('ne suit la police système nulle part, grille comprise', () => {
    const texts = tagsNamed(file, 'Text');
    assert.ok(texts.length >= 4, `${texts.length} textes`);
    const scaling = texts.filter((t) => !fixed(t));
    assert.equal(scaling.length, 0, `suit la police : ${linesOf(scaling)}`);

    const grids = tagsNamed(file, 'BentoGrid');
    assert.equal(grids.length, 1);
    assert.equal(grids[0]?.attributes.get('allowFontScaling'), 'false');
  });
});
