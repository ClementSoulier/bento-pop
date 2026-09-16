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
 * Ce qui lui déplaît, sur la table `bentos` : **supposer une seule ligne à
 * partir d'un filtre de compte**. Concrètement, une chaîne qui porte
 * `.eq('user_id', …)` et l'une de ces trois formes :
 *
 * - `.maybeSingle()` ou `.single()`, qui rendent `PGRST116` dès qu'un compte
 *   a deux bentos, et qu'un `{ data }` déstructuré sans `error` avale en
 *   silence ;
 * - `.limit(1)` sans `order`, qui prend la première ligne venue.
 *
 * **Lister les bentos d'un compte reste permis**, et c'est même ce qu'il faut
 * faire : `listOwnBentos` et l'export RGPD filtrent par `user_id` et rendent
 * une liste. La première version de ce test les refusait aussi, ce qui
 * l'aurait rendu impossible à satisfaire autrement qu'en le contournant.
 *
 * Tout est permis sur une clé primaire : `.eq('id', …).maybeSingle()` nomme
 * sa ligne.
 */

const APP_ROOT = join(__dirname, '..', '..');

/**
 * Ce qui reste à reprendre, avec le lot qui s'en charge.
 *
 * Une liste et non une exception muette : elle rend la dette visible en revue,
 * et surtout elle empêche qu'elle grandisse. Un nouvel appelant fautif échoue
 * immédiatement.
 *
 * **Vidée au lot 4**, comme prévu. Le dernier test s'assure qu'elle le reste
 * juste : il échoue si une entrée ne correspond plus à rien, pour qu'une
 * exception ne survive pas à sa correction.
 */
const DETTE = new Map<string, string>([]);

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

/** Suppose-t-elle une seule ligne, d'une façon ou d'une autre ? */
function supposeUneLigne(text: string): boolean {
  if (/\.(maybeSingle|single)\(\)/.test(text)) return true;
  // `limit(1)` sans `order` prend la première ligne que PostgREST rend, ce
  // qui n'est pas défini. Avec un `order`, c'est un choix assumé.
  return /\.limit\(\s*1\s*\)/.test(text) && !/\.order\(/.test(text);
}

/** Une chaîne fautive : elle filtre par compte et suppose une seule ligne. */
function fautive(c: Appel): boolean {
  return filtreParCompte(c.text) && supposeUneLigne(c.text) && !nommeSonBento(c.text);
}

describe('aucune requête ne demande « le » bento d’un compte', () => {
  const chaines = chainesSurBentos();

  it('trouve bien les requêtes à surveiller', () => {
    // Garde-fou du garde-fou : un test qui n'inspecte rien passe toujours.
    assert.ok(chaines.length >= 3, `${chaines.length} chaînes trouvées, c'est trop peu`);
  });

  it('ne suppose jamais une seule ligne à partir d’un filtre de compte', () => {
    const fautes = chaines.filter(fautive).filter((c) => !DETTE.has(c.path));
    assert.deepEqual(
      fautes.map((c) => `${c.path}:${c.line}`),
      [],
      'un filtre par compte ne peut plus rendre une ligne unique',
    );
  });

  it('laisse lister les bentos d’un compte', () => {
    // Témoin : si ce test ne trouve rien, c'est que la règle du dessus est
    // devenue trop large et qu'elle interdit aussi les listes légitimes.
    const listes = chaines.filter((c) => filtreParCompte(c.text) && !fautive(c));
    assert.ok(listes.length >= 2, 'les listes par compte doivent rester permises');
  });

  it('garde la dette exacte, ni plus ni moins', () => {
    // Une entrée qui ne correspond plus à rien se retire : sinon la liste
    // devient une exception permanente que personne ne relit.
    const fautifs = new Set(chaines.filter(fautive).map((c) => c.path));
    const perimees = [...DETTE.keys()].filter((path) => !fautifs.has(path));
    assert.deepEqual(perimees, [], `corrigé, à retirer de DETTE :\n  ${perimees.join('\n  ')}`);
  });
});
