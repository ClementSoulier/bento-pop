import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import * as ts from 'typescript';

/**
 * Plus aucune requête ne demande « le » bento d'un compte.
 *
 * C'est la règle qui tient le chantier 16, et elle ne se vérifie pas à
 * l'exécution : une requête qui devine ne lève pas, elle rend le mauvais
 * bento, ou le bon par chance tant que les comptes n'en ont qu'un. Ce test la
 * lit donc dans le source, comme `accessibilite.test.ts` et
 * `font-scaling.test.ts` lisent les leurs, et échoue avec le fichier et la
 * ligne.
 *
 * Deux choses lui déplaisent, sur la table `bentos` :
 *
 * - `.maybeSingle()` ou `.single()`, qui supposent qu'il n'y a qu'une ligne.
 *   Depuis la levée de `bentos_user_id_key`, deux bentos rendent `PGRST116`
 *   et un `{ data }` déstructuré sans `error` avale le refus en silence ;
 * - un filtre `.eq('user_id', …)` qui ne dit pas **quel** bento, c'est-à-dire
 *   sans `is_primary`, `slug` ni `id` dans la même chaîne d'appels.
 *
 * Les deux sont permis sur une clé primaire : `.eq('id', …).maybeSingle()`
 * nomme sa ligne.
 */

const APP_ROOT = join(__dirname, '..', '..');

/**
 * Ce qui reste à reprendre, avec le lot qui s'en charge.
 *
 * Une liste et non une exception muette : elle rend la dette visible en
 * revue, et surtout elle empêche qu'elle grandisse. Un nouvel appelant
 * fautif échoue immédiatement.
 *
 * **Le lot 4 doit vider cette liste.** Le test du bas s'en assure : il échoue
 * le jour où une entrée ne correspond plus à rien, pour qu'on ne la traîne pas
 * après l'avoir corrigée.
 */
const DETTE = new Map<string, string>([
  ['src/lib/bento-actions.ts', 'lot 4 : ensureBento et loadOwnBento'],
  ['src/state/session.ts', 'lot 4 : readBento, hydratation au démarrage'],
  ['src/lib/data-export.ts', 'lot 4 : export RGPD, charge utile au singulier'],
]);

type Appel = { path: string; line: number; text: string };

function sources(): string[] {
  return readdirSync(APP_ROOT, { recursive: true, encoding: 'utf8' }).filter(
    (path) =>
      /^(app|src)\//.test(path) &&
      /\.tsx?$/.test(path) &&
      !path.includes('node_modules') &&
      !/\.test\.tsx?$/.test(path),
  );
}

/**
 * Les chaînes d'appels qui partent de `.from('bentos')`.
 *
 * Le texte entier de la chaîne est retenu : c'est sur lui qu'on cherche le
 * discriminant, parce qu'il peut arriver avant comme après le filtre.
 */
function chainesSurBentos(): Appel[] {
  const trouves: Appel[] = [];
  for (const path of sources()) {
    const text = readFileSync(join(APP_ROOT, path), 'utf8');
    if (!text.includes("from('bentos')")) continue;
    const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && node.expression.getText().endsWith('.from')) {
        const argument = node.arguments[0];
        if (argument && ts.isStringLiteral(argument) && argument.text === 'bentos') {
          // La chaîne complète : on remonte tant que le parent est un accès
          // de propriété ou un appel, pour attraper les `.eq().maybeSingle()`
          // posés après le `.from()`.
          let sommet: ts.Node = node;
          while (
            sommet.parent &&
            (ts.isPropertyAccessExpression(sommet.parent) || ts.isCallExpression(sommet.parent))
          ) {
            sommet = sommet.parent;
          }
          trouves.push({
            path,
            line: file.getLineAndCharacterOfPosition(node.getStart()).line + 1,
            text: sommet.getText(),
          });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  }
  return trouves;
}

/** Nomme-t-elle le bento qu'elle veut ? */
function nommeSonBento(text: string): boolean {
  return /\.eq\(\s*'(id|slug|is_primary)'/.test(text) || /\.is\(\s*'slug'/.test(text);
}

/** Filtre-t-elle par compte, ce qui avec plusieurs bentos ne suffit plus ? */
function filtreParCompte(text: string): boolean {
  return /\.eq\(\s*'user_id'/.test(text);
}

function supposeUneLigne(text: string): boolean {
  return /\.(maybeSingle|single)\(\)/.test(text);
}

describe('aucune requête ne demande « le » bento d’un compte', () => {
  const chaines = chainesSurBentos();

  it('trouve bien les requêtes à surveiller', () => {
    // Garde-fou du garde-fou : un test qui n'inspecte rien passe toujours.
    assert.ok(chaines.length >= 3, `${chaines.length} chaînes trouvées, c'est trop peu`);
  });

  it('ne filtre jamais par compte sans dire quel bento', () => {
    const fautes = chaines
      .filter((c) => filtreParCompte(c.text) && !nommeSonBento(c.text))
      .filter((c) => !DETTE.has(c.path))
      .map((c) => `${c.path}:${c.line}`);
    assert.deepEqual(fautes, [], `filtre par compte sans nommer le bento :\n  ${fautes.join('\n  ')}`);
  });

  it('ne suppose jamais une seule ligne sur un filtre de compte', () => {
    const fautes = chaines
      .filter((c) => supposeUneLigne(c.text) && filtreParCompte(c.text))
      .filter((c) => !DETTE.has(c.path))
      .map((c) => `${c.path}:${c.line}`);
    assert.deepEqual(fautes, [], `maybeSingle() sur un filtre de compte :\n  ${fautes.join('\n  ')}`);
  });

  it('garde la dette du lot 4 exacte, ni plus ni moins', () => {
    // Une entrée qui ne correspond plus à rien se retire : sinon la liste
    // devient une exception permanente que personne ne relit.
    const fautifs = new Set(
      chaines
        .filter((c) => filtreParCompte(c.text) && !nommeSonBento(c.text))
        .map((c) => c.path),
    );
    const perimees = [...DETTE.keys()].filter((path) => !fautifs.has(path));
    assert.deepEqual(perimees, [], `corrigé, à retirer de DETTE :\n  ${perimees.join('\n  ')}`);
  });
});
