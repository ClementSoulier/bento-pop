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

/** Les balises de ces noms, ou toutes quand `names` est nul. */
function tags(names: Set<string> | null): Tag[] {
  const found: Tag[] = [];
  for (const path of files()) {
    const text = readFileSync(join(APP_ROOT, path), 'utf8');
    const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node: ts.Node) => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tag = node.tagName.getText();
        if (names === null || names.has(tag)) {
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
 * Sur iOS, React Native compose lui-même, et en anglais seulement, les mots
 * d'une case à cocher et d'un bouton radio, et ceux des états coché, déplié ou
 * en attente : la case des conditions s'annonçait « checkbox, unchecked » sur
 * un iPhone en français (chantier 29, D18). Ils passent donc par
 * `src/lib/a11y-states.ts`, qui les remplace sur iOS par des traits natifs et
 * une valeur française. Seul l'interrupteur garde son état coché : React
 * Native lui donne le trait natif, que VoiceOver traduit.
 *
 * Les actions aussi : la nouvelle architecture fait de chaque action déclarée
 * une action de VoiceOver, nommée par son libellé, à défaut par son nom.
 * La notification du design system proposait ainsi « activate » (chantier 30,
 * lot 5).
 */
describe('ce que React Native lirait en anglais sur iOS', () => {
  const all = tags(null);

  it('aucune case à cocher ni bouton radio écrits en dur', () => {
    const literal = all.filter((t) => {
      const role = t.attributes.get('accessibilityRole') ?? t.attributes.get('role');
      return role === 'checkbox' || role === 'radio';
    });
    assert.equal(literal.length, 0, `rôle lu en anglais : ${where(literal)}`);
  });

  it('aucun état coché, déplié ou en attente écrit en dur, hors interrupteur', () => {
    const literal = all.filter((t) => {
      const state = t.attributes.get('accessibilityState');
      if (typeof state !== 'string' || !state.trimStart().startsWith('{')) return false;
      if (t.attributes.get('accessibilityRole') === 'switch') return false;
      return /\b(checked|busy|expanded)\b/.test(state);
    });
    assert.equal(literal.length, 0, `état lu en anglais : ${where(literal)}`);
  });

  it('chaque action d’accessibilité porte un libellé', () => {
    const unlabelled = all.filter((t) => {
      const actions = t.attributes.get('accessibilityActions');
      if (typeof actions !== 'string') return false;
      return (actions.match(/\{[^{}]*\}/g) ?? []).some((entry) => !/\blabel\s*:/.test(entry));
    });
    assert.equal(unlabelled.length, 0, `action nommée en anglais : ${where(unlabelled)}`);
  });
});

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

/**
 * Chantier 21 : les sections des réglages et de la modification du profil
 * s'annoncent comme des titres, que VoiceOver et TalkBack parcourent de l'un
 * à l'autre. Celles que rendaient leurs propres composants, Notifications et
 * Confidentialité, ne l'étaient pas, à la recette du lot 3 : toutes passent
 * maintenant par `SectionTitle`.
 */
describe('champs de saisie', () => {
  /**
   * Fabric recycle un champ de saisie sans remettre à zéro ses attributs de
   * texte : un attribut facultatif, absent du champ suivant, y survit. Relevé
   * au chantier 28, lot 3 : l'espacement du champ du code ressortait dans
   * l'exemple du champ d'adresse affiché après lui. Un champ n'en pose donc
   * aucun ; la mise en forme passe par la police, sa taille et sa couleur.
   */
  it('ne pose ni espacement, ni soulignement, ni ombre que le recyclage garderait', () => {
    const fautifs = tags(new Set(['TextInput'])).filter((t) => {
      const style = t.attributes.get('style');
      return typeof style === 'string' && /letterSpacing|textDecoration|textShadow/.test(style);
    });
    assert.equal(fautifs.length, 0, where(fautifs));
  });
});

describe('titres des sections', () => {
  const parse = (path: string) =>
    ts.createSourceFile(
      path,
      readFileSync(join(APP_ROOT, path), 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

  /** Le rôle posé sur une balise, `undefined` sans rôle. */
  const roleOf = (node: ts.JsxOpeningLikeElement) => {
    for (const attribute of node.attributes.properties) {
      if (ts.isJsxAttribute(attribute) && attribute.name.getText() === 'accessibilityRole') {
        const value = attribute.initializer;
        return value && ts.isStringLiteral(value) ? value.text : value?.getText();
      }
    }
    return undefined;
  };

  /** Ce que disent les `<SectionTitle>` d'un fichier, dans l'ordre. */
  const sectionTitles = (path: string): string[] => {
    const found: string[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isJsxElement(node) && node.openingElement.tagName.getText() === 'SectionTitle') {
        found.push(node.children.map((c) => (ts.isJsxText(c) ? c.text : '?')).join('').trim());
      }
      ts.forEachChild(node, visit);
    };
    visit(parse(path));
    return found;
  };

  it('rend un titre', () => {
    const roles: (string | undefined)[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        if (node.tagName.getText() === 'Text') roles.push(roleOf(node));
      }
      ts.forEachChild(node, visit);
    };
    visit(parse('src/components/primitives/SectionTitle.tsx'));
    assert.deepEqual(roles, ['header']);
  });

  it('nomme chaque section des réglages et du profil par lui', () => {
    const expected: [string, string[]][] = [
      ['app/settings.tsx', ['À propos', 'Comptes bloqués', 'Compte']],
      ['src/components/NotificationSettings.tsx', ['Notifications']],
      ['src/components/PrivacySettings.tsx', ['Confidentialité']],
      // « Tes réseaux », du chantier 25, vient après dans le fichier : sa
      // section est un composant à part, rendu entre le nom et le pseudo.
      ['app/profile/edit.tsx', ['Ton Popy', 'Ton nom', 'Ton pseudo', 'Tes réseaux']],
    ];
    for (const [path, titles] of expected) {
      assert.deepEqual(sectionTitles(path), titles, path);
    }
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
