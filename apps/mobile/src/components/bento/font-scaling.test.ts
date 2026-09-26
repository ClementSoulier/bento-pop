import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import * as ts from 'typescript';
import { extendaAccentRoom } from '@/lib/display-title';
import { NATURAL_LINE_EM, fontScaleFor, naturalLineHeight, scaledType } from './font-scaling';

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

describe('scaledType', () => {
  it('multiplie taille et hauteur de ligne par le même facteur plafonné', () => {
    assert.deepEqual(scaledType(1, 1.2, 15, 20), { fontSize: 15, lineHeight: 20 });
    assert.deepEqual(scaledType(3.571, 1.2, 15, 20), { fontSize: 18, lineHeight: 24 });
    assert.deepEqual(scaledType(Number.NaN, 1.4, 13, 19), { fontSize: 13, lineHeight: 19 });
  });
});

describe('naturalLineHeight', () => {
  it('rend les hauteurs relevées dans l’arbre d’accessibilité de l’iPhone 17 Pro', () => {
    assert.equal(naturalLineHeight('Bungee', 10).toFixed(3), '13.333');
    assert.equal(naturalLineHeight('Bungee', 11).toFixed(3), '14.667');
    assert.equal(naturalLineHeight('Bungee', 15), 20);
  });

  it('arrondit au tiers de point supérieur, sans se laisser tromper par la virgule flottante', () => {
    // 25 × 1,32 × 3 = 99 exactement, qu'une multiplication flottante rend 99,000…01.
    assert.equal(naturalLineHeight('Bungee', 25), 33);
    for (let size = 8; size <= 40; size += 0.5) {
      for (const font of Object.keys(NATURAL_LINE_EM) as (keyof typeof NATURAL_LINE_EM)[]) {
        const height = naturalLineHeight(font, size);
        const exact = size * NATURAL_LINE_EM[font];
        assert.ok(height >= exact - 0.01 && height < exact + 1 / 3, `${font} ${size}`);
        assert.ok(Math.abs(height * 3 - Math.round(height * 3)) < 1e-9, `${font} ${size}`);
      }
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
    const allowed = new Set(['CONTENT_MAX_FONT_MULTIPLIER', 'CONTROL_MAX_FONT_MULTIPLIER']);
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
      (t) => !fixed(t) || capsOf(t).join() !== 'CONTROL_MAX_FONT_MULTIPLIER',
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
    // Cinq et non plus six depuis le 17 septembre 2026 : « En attente » n'est
    // plus un texte, la pastille d'un item en attente est un sablier dessiné,
    // qui ne suit pas la police, cf. `tile-pending.ts`.
    assert.ok(tileTexts.length >= 5, `Tile : ${tileTexts.length} textes`);
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
   * L'étiquette, le titre et le sous-titre : les textes dont la hauteur décide
   * de la place restante dans la case, cf. `tile-text.ts`. « En attente » en
   * était un jusqu'au 17 septembre 2026 ; la pastille ne porte plus de texte et
   * ne prend plus de place au texte, cf. `tile-pending.ts`.
   */
  it('applique à ses textes la police que la case permet, figée quand la grille le demande', () => {
    const scaled = tileTexts.filter((t) => /\btextScale\b/.test(t.styleSource));
    assert.equal(scaled.length, 3, `textes à l’échelle de la case : ${linesOf(scaled)}`);
    // `tileTextLayout` ou `tileTextScale` : le premier étend le second au
    // nombre de lignes de l'étiquette, pour la question d'une édition
    // (proposition A, 16 septembre 2026), et rend exactement le second pour une
    // étiquette d'une ligne, ce que `tile-text.test.ts` vérifie sur toutes les
    // tailles, échelles et polices. La règle de ce test ne change pas.
    const wrong = scaled.filter(
      (t) =>
        !fixed(t) ||
        !/\btileText(?:Scale|Layout)\(/.test(t.styleSource) ||
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

/** Les plafonds nommés de l'app, cf. `font-scaling.ts`. */
const CAPS = new Set([
  'CONTENT_MAX_FONT_MULTIPLIER',
  'CONTROL_MAX_FONT_MULTIPLIER',
  'TITLE_MAX_FONT_MULTIPLIER',
  'TILE_MAX_FONT_MULTIPLIER',
]);

type AppText = Tag & {
  path: string;
  tag: string;
  /** Ce que le texte affiche, commentaires compris ; vide pour une balise auto-fermante. */
  children: readonly ts.JsxChild[];
};

/**
 * Tous les textes de l'app : `<Text>`, `<TextInput>` et `<Animated.Text>` de
 * `app/` et `src/`, hors tests. Un texte imbriqué dans un autre en hérite la
 * police et n'est pas compté.
 */
function appTexts(): AppText[] {
  const files = readdirSync(APP_ROOT, { recursive: true, encoding: 'utf8' }).filter(
    (path) =>
      /^(app|src)\//.test(path) &&
      path.endsWith('.tsx') &&
      !path.includes('node_modules') &&
      !/\.test\.tsx$/.test(path),
  );
  const names = new Set(['Text', 'TextInput', 'Animated.Text']);
  /**
   * Composants qui rendent leurs enfants dans un texte à eux, plafonné : un
   * `<Text>` passé en enfant y est imbriqué à l'exécution.
   */
  const wrappers = new Set(['RuleLine', 'Sticker', 'StampButton']);
  const texts: AppText[] = [];
  for (const path of files) {
    const file = parse(path);
    const visit = (node: ts.Node, insideText: boolean) => {
      let inside = insideText;
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
        const opening = ts.isJsxElement(node) ? node.openingElement : node;
        const tag = opening.tagName.getText();
        if (names.has(tag)) {
          if (!insideText) {
            const style = opening.attributes.properties.find(
              (a): a is ts.JsxAttribute => ts.isJsxAttribute(a) && a.name.getText() === 'style',
            );
            const expression =
              style?.initializer && ts.isJsxExpression(style.initializer)
                ? style.initializer.expression
                : undefined;
            texts.push({
              path,
              tag,
              line: file.getLineAndCharacterOfPosition(opening.getStart()).line + 1,
              attributes: attributesOf(opening),
              styleSource: expression ? resolvedSource(expression, opening) : '',
              children: ts.isJsxElement(node) ? node.children : [],
            });
          }
          inside = tag !== 'TextInput';
        } else if (wrappers.has(tag)) {
          inside = true;
        }
      }
      ts.forEachChild(node, (child) => visit(child, inside));
    };
    visit(file, false);
  }
  return texts;
}

const where = (texts: AppText[]) => texts.map((t) => `${t.path}, ligne ${t.line}`).join(' ; ');

/**
 * Le chantier 11 étend à toute l'app la règle de la page publique et des cases.
 * Sans elle, 87 des 128 textes de l'app suivaient la police sans plafond, et
 * l'accueil d'un iPhone 17 Pro poussait son bouton hors de l'écran dès la plus
 * grande taille standard : on ne pouvait plus s'inscrire.
 */
describe('toute l’app', () => {
  const texts = appTexts();

  it('trouve les textes de l’app', () => {
    assert.ok(texts.length >= 120, `${texts.length} textes`);
  });

  it('plafonne chaque texte, ou lui applique la police lui-même', () => {
    const uncapped = texts.filter((t) => !fixed(t) && !t.attributes.has('maxFontSizeMultiplier'));
    assert.equal(uncapped.length, 0, `sans plafond : ${where(uncapped)}`);
  });

  it('prend ses plafonds dans `font-scaling.ts`, jamais en nombres recopiés', () => {
    const copied = texts.filter((t) => {
      const cap = t.attributes.get('maxFontSizeMultiplier');
      const scaled = [
        ...t.styleSource.matchAll(/\b(?:fontScaleFor|scaledType)\(\s*fontScale\s*,\s*([^,)\s]+)/g),
      ].map((m) => m[1] ?? '');
      return (
        (cap !== undefined && (typeof cap !== 'string' || !CAPS.has(cap))) ||
        scaled.some((c) => !CAPS.has(c))
      );
    });
    assert.equal(copied.length, 0, `plafond recopié : ${where(copied)}`);
  });
});

/**
 * Les déclarations de premier niveau d'un fichier, et les entrées de ses
 * `StyleSheet.create` sous leur nom d'usage, `styles.title` : ce que
 * `resolvedSource`, qui s'arrête au composant, ne voit pas.
 */
function moduleDeclarations(path: string): Map<string, ts.Expression> {
  const declarations = new Map<string, ts.Expression>();
  for (const statement of parse(path).statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      const init = declaration.initializer;
      if (!ts.isIdentifier(declaration.name) || !init) continue;
      const name = declaration.name.text;
      declarations.set(name, init);
      const [sheet] =
        ts.isCallExpression(init) && init.expression.getText() === 'StyleSheet.create'
          ? init.arguments
          : [];
      if (!sheet || !ts.isObjectLiteralExpression(sheet)) continue;
      for (const entry of sheet.properties) {
        if (ts.isPropertyAssignment(entry)) {
          declarations.set(`${name}.${entry.name.getText()}`, entry.initializer);
        }
      }
    }
  }
  return declarations;
}

/** Le style d'un texte, constantes du fichier et feuilles de style comprises. */
function fullStyleSource(t: AppText, declarations: Map<string, ts.Expression>): string {
  const parts = [t.styleSource];
  const resolved = new Set<string>();
  for (let i = 0; i < parts.length; i++) {
    for (const [, head, property] of (parts[i] ?? '').matchAll(
      /\b([A-Za-z_$][\w$]*)(?:\.([A-Za-z_$][\w$]*))?/g,
    )) {
      // `styles.title` renvoie à son entrée seule, jamais à toute la feuille.
      const name = property ? `${head}.${property}` : (head ?? '');
      const declared = declarations.get(name);
      if (!declared || resolved.has(name)) continue;
      resolved.add(name);
      parts.push(declared.getText());
    }
  }
  return parts.join('\n');
}

/**
 * Le texte d'un titre fixe, écrit dans le code, ou `undefined` s'il vient des
 * données. Les blancs du JSX se replient comme React les replie.
 */
function fixedText(
  children: readonly ts.JsxChild[],
  declarations: Map<string, ts.Expression>,
): string | undefined {
  let text = '';
  for (const child of children) {
    if (ts.isJsxText(child)) {
      text += child.text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .join(' ');
    } else if (ts.isJsxElement(child)) {
      const inner = fixedText(child.children, declarations);
      if (inner === undefined) return undefined;
      text += inner;
    } else if (ts.isJsxExpression(child)) {
      if (!child.expression) continue;
      const expression = ts.isIdentifier(child.expression)
        ? (declarations.get(child.expression.text) ?? child.expression)
        : child.expression;
      if (!ts.isStringLiteralLike(expression)) return undefined;
      text += expression.text;
    } else {
      return undefined;
    }
  }
  return text;
}

/** Ce que l'app n'écrit jamais avec un accent, ou n'écrit pas pour être lu. */
const WITHOUT_ACCENTS = [
  // Un pseudo, en ASCII seulement : cf. `lib/pseudo-match.ts`.
  /pseudo/i,
  // Une initiale en filigrane, un décor : laissée telle quelle le 26 septembre 2026.
  /\b(?:getInitial|initialOf)\(/,
];

/**
 * Extenda dessine les accents de ses capitales au-dessus de son ascendante, et
 * iOS commence la ligne à l'ascendante, même sans hauteur de ligne posée : un
 * titre en capitales perd l'accent de sa première ligne s'il ne réserve pas sa
 * place, cf. `display-title.ts`.
 *
 * Le titre du composer l'a perdu en devenant le titre d'une édition, au
 * chantier 16, sans que rien ne le signale avant la recette du 26 septembre
 * 2026 : « EDITION DE RECETTE ». Les titres de case, de la recherche et
 * « CRÉDITS » en perdaient une partie depuis toujours. Tout titre en Extenda et
 * en capitales réserve donc cette place, sauf un titre fixe sans accent en
 * première ligne, et ce que l'app n'écrit jamais avec un accent.
 */
describe('les accents d’Extenda', () => {
  const titles = appTexts().flatMap((t) => {
    const declarations = moduleDeclarations(t.path);
    const style = fullStyleSource(t, declarations);
    if (!/fontFamily:\s*'Extenda'/.test(style) || !/textTransform:\s*'uppercase'/.test(style)) {
      return [];
    }
    const shown = t.children.map((child) => child.getText()).join('');
    return [{ ...t, style, shown, fixed: fixedText(t.children, declarations) }];
  });
  const exposed = titles.filter((t) =>
    t.fixed === undefined
      ? !WITHOUT_ACCENTS.some((pattern) => pattern.test(t.shown))
      : extendaAccentRoom(t.fixed, 1) > 0,
  );

  it('trouve les titres en Extenda et en capitales, feuilles de style comprises', () => {
    assert.ok(titles.length >= 15, `${titles.length} titres`);
    // Composer, case, tuile de recherche, crédits, accueil, en-têtes de section.
    assert.ok(exposed.length >= 6, `${exposed.length} titres à accents : ${where(exposed)}`);
  });

  it('réserve la place des accents de tout titre qui peut en porter', () => {
    const clipped = exposed.filter(
      (t) => !/\bpaddingTop\b/.test(t.style) || !/\bextendaAccentRoom\(/.test(t.style),
    );
    assert.equal(clipped.length, 0, `accents rognés : ${where(clipped)}`);
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
