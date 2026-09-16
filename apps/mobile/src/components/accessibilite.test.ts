import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import * as ts from 'typescript';

/**
 * Ce que le lecteur d'écran trouve, lu dans le code source.
 *
 * Un élément tapable sans rôle est annoncé comme un élément quelconque, un champ
 * sans libellé comme « champ de texte », et rien à l'exécution ne le signale :
 * l'app tourne, seule la voix manque. Relevé au chantier 11 sur l'arbre
 * d'accessibilité des deux plateformes, ce test le garde dans le code, avec la
 * ligne fautive.
 *
 * Même méthode que `font-scaling.test.ts`, dont il partage la lecture de l'arbre
 * syntaxique.
 */

const APP_ROOT = join(__dirname, '..', '..');

/** Composants tapables de React Native rendus directement par l'app. */
const PRESSABLES = new Set(['Pressable', 'TouchableOpacity', 'TouchableHighlight']);

type Tag = {
  path: string;
  tag: string;
  line: number;
  attributes: Map<string, string | true>;
};

function files(): string[] {
  return readdirSync(APP_ROOT, { recursive: true, encoding: 'utf8' }).filter(
    (path) =>
      /^(app|src)\//.test(path) &&
      path.endsWith('.tsx') &&
      !path.includes('node_modules') &&
      !/\.test\.tsx$/.test(path),
  );
}

function tags(names: Set<string>): Tag[] {
  const found: Tag[] = [];
  for (const path of files()) {
    const text = readFileSync(join(APP_ROOT, path), 'utf8');
    const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node: ts.Node) => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tag = node.tagName.getText();
        if (names.has(tag)) {
          const attributes = new Map<string, string | true>();
          for (const attribute of node.attributes.properties) {
            if (!ts.isJsxAttribute(attribute)) {
              attributes.set('__spread', attribute.getText());
              continue;
            }
            const name = attribute.name.getText();
            const value = attribute.initializer;
            if (!value) attributes.set(name, true);
            else if (ts.isStringLiteral(value)) attributes.set(name, value.text);
            else if (ts.isJsxExpression(value) && value.expression) {
              attributes.set(name, value.expression.getText());
            }
          }
          found.push({
            path,
            tag,
            line: file.getLineAndCharacterOfPosition(node.getStart()).line + 1,
            attributes,
          });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  }
  return found;
}

const where = (list: Tag[]) => list.map((t) => `${t.path}, ligne ${t.line}`).join(' ; ');

/**
 * Les deux seuls tapables qui n'annoncent rien eux-mêmes : ils reçoivent leur
 * rôle et leur libellé de qui les rend, et leur propre fichier les pose.
 */
const FROM_PROPS = new Set(['src/components/primitives/StampButton.tsx']);

describe('éléments tapables', () => {
  const pressables = tags(PRESSABLES);

  it('trouve les éléments tapables de l’app', () => {
    assert.ok(pressables.length >= 25, `${pressables.length} éléments`);
  });

  it('dit son rôle', () => {
    const mute = pressables.filter(
      (t) =>
        !t.attributes.has('accessibilityRole') &&
        !t.attributes.has('role') &&
        !FROM_PROPS.has(t.path),
    );
    assert.equal(mute.length, 0, `sans rôle : ${where(mute)}`);
  });

  it('dit ce qu’il fait', () => {
    const unnamed = pressables.filter(
      (t) => !t.attributes.has('accessibilityLabel') && !FROM_PROPS.has(t.path),
    );
    assert.equal(unnamed.length, 0, `sans libellé : ${where(unnamed)}`);
  });

  /**
   * Un tapable désactivé doit le dire : sinon le lecteur d'écran l'annonce
   * comme actionnable et le tap ne fait rien.
   */
  it('dit qu’il est désactivé quand il l’est', () => {
    const silent = pressables.filter(
      (t) => t.attributes.has('disabled') && !t.attributes.has('accessibilityState'),
    );
    assert.equal(silent.length, 0, `état non annoncé : ${where(silent)}`);
  });

  /**
   * Et il doit aussi le **montrer**. Sous le runtime JSX de NativeWind, la forme
   * `style={({ pressed }) => …}` n'est pas appliquée du tout : mesuré au
   * chantier 11 sur le CTA du composer, qui avait perdu en silence son ombre
   * stamp, son retour à l'appui et son grisé désactivé, et se présentait donc
   * comme actif alors qu'il était inerte. Rien à l'exécution ne le signale : le
   * style part, l'app tourne. La seule trace possible est dans le source, d'où
   * ce garde-fou. Cf. `StampButton.tsx` et `FeedPost.tsx`.
   */
  it('ne confie pas son style à une fonction de pressed', () => {
    const fn = pressables.filter((t) => {
      const style = t.attributes.get('style');
      return typeof style === 'string' && /^\(?\s*(\{|\w)[^)]*\)?\s*=>/.test(style.trim());
    });
    assert.equal(fn.length, 0, `style en fonction : ${where(fn)}`);
  });
});

describe('champs de saisie', () => {
  const inputs = tags(new Set(['TextInput']));

  it('trouve les champs de l’app', () => {
    // La recherche de la modale, celle de « Trouver », le pseudo de l'accueil.
    assert.ok(inputs.length >= 3, `${inputs.length} champs`);
  });

  it('a un libellé, jamais son seul texte d’invite', () => {
    const unnamed = inputs.filter((t) => !t.attributes.has('accessibilityLabel'));
    assert.equal(unnamed.length, 0, `sans libellé : ${where(unnamed)}`);
  });
});

describe('contrastes', () => {
  /**
   * L'encre `#0a0a0a` à 55 % sur le jaune de l'app donne 3,84 : 1, sous les
   * 4,5 : 1 du WCAG pour un texte normal, et à 35 % sur le crème d'une case
   * vide, 2,32 : 1. Ces opacités vivent maintenant dans `primitives/ink.ts`,
   * où le rapport se vérifie une fois : 65 % pour un texte secondaire, 60 %
   * pour une invite, un onglet inactif ou une flèche, jamais moins. Un
   * littéral recopié, lui, ne se relit jamais.
   */
  it('ne pose pas de texte ni d’icône sous 60 % d’encre', () => {
    const faint: string[] = [];
    for (const path of files()) {
      readFileSync(join(APP_ROOT, path), 'utf8')
        .split('\n')
        .forEach((line, index) => {
          const found = /(\w*[Cc]olor)\s*[:=]\s*['"{]*rgba\(10, ?10, ?10, ?(0?\.\d+)\)/.exec(line);
          if (!found) return;
          const [, property, alpha] = found;
          // Un fond, une bordure ou une ombre ne portent pas de texte.
          if (/border|background|shadow/i.test(property ?? '')) return;
          if (Number(alpha) < 0.6) faint.push(`${path}, ligne ${index + 1} : ${property} ${alpha}`);
        });
    }
    assert.equal(faint.length, 0, faint.join(' ; '));
  });
});
