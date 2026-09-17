import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import * as ts from 'typescript';

/**
 * Une rangée de la boîte porte sa hauteur, elle ne se la partage pas.
 *
 * Ce test existe parce que l'aperçu de lien a dessiné pendant des mois une
 * boîte qui n'était pas celle de l'app ni celle de la page web, sans que rien
 * ne le signale. `opengraph-image.tsx` n'importait pas `ROW_HEIGHTS` et posait
 * `flex: 1` sur chaque rangée : les trois se partageaient la hauteur à parts
 * égales.
 *
 * Mesuré au pixel le 16 septembre 2026, sur l'image de production de
 * `@dark_hifus` et sur la page web du même bento, au même moment :
 *
 * ```
 * aperçu de lien : 160,0 / 160,0 / 160,0
 * page web       : 259,2 / 157,2 / 117,0     (soit 220 / 134 / 100 × 1,178)
 * ```
 *
 * Le compartiment film perdait 73 px, soit 31 % de sa hauteur, dans chaque
 * lien partagé ; la rangée basse en gagnait 54, soit 51 %.
 *
 * **Pourquoi lire le source plutôt que rendre l'image.** Le défaut ne lève
 * pas, ne casse aucun type et ne change aucune dimension extérieure : le
 * contour de la boîte restait juste au millième près. Seule une mesure des
 * rangées l'aurait vu, et rendre du satori sous `node:test` demanderait les
 * polices et un décodeur d'image pour un verdict que la règle suffit à
 * donner. Cf. `apps/mobile/src/lib/bento-queries.test.ts`, même méthode.
 *
 * **La règle vérifiée** : tout style qui pose l'écart du cadre (`FRAME.gap`)
 * est un conteneur de la boîte ; il doit déclarer sa hauteur, et ne jamais
 * grandir tout seul.
 */

// `__dirname` et non `import.meta.dirname` : `tsx` transpile ces tests en CJS,
// où le second vaut `undefined`. Même choix que `bento-queries.test.ts:35`.
const OG_FILE = join(__dirname, '..', '..', 'app', 'u', '[pseudo]', 'opengraph-image.tsx');

/** Styles inline qui posent l'écart du cadre, avec leur ligne. */
function frameContainers(source: ts.SourceFile) {
  const found: { line: number; props: Map<string, string> }[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isObjectLiteralExpression(node)) {
      const props = new Map<string, string>();
      for (const prop of node.properties) {
        if (!ts.isPropertyAssignment(prop)) continue;
        const name = prop.name.getText(source);
        props.set(name, prop.initializer.getText(source));
      }
      const gap = props.get('gap');
      if (gap?.includes('FRAME.gap')) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
        found.push({ line: line + 1, props });
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
  return found;
}

describe('rangées de l’aperçu de lien', () => {
  const text = readFileSync(OG_FILE, 'utf8');
  const source = ts.createSourceFile(OG_FILE, text, ts.ScriptTarget.Latest, true);
  const containers = frameContainers(source);

  it('trouve les conteneurs de la boîte', () => {
    // Témoin : si le rendu est réécrit et que plus rien ne pose `FRAME.gap`,
    // les deux tests suivants passeraient à vide et ne garderaient plus rien.
    assert.ok(
      containers.length >= 2,
      `un seul conteneur trouvé : la boîte et ses rangées devraient en faire au moins deux`,
    );
  });

  it('donne à chacun une hauteur explicite', () => {
    for (const { line, props } of containers) {
      assert.ok(
        props.has('height'),
        `opengraph-image.tsx:${line} : conteneur sans \`height\`, sa hauteur dépend donc de ses voisins`,
      );
    }
  });

  it('n’en laisse aucun grandir tout seul', () => {
    for (const { line, props } of containers) {
      const flex = props.get('flex') ?? props.get('flexGrow');
      assert.equal(
        flex,
        undefined,
        `opengraph-image.tsx:${line} : \`flex: ${flex}\` sur un conteneur de la boîte, ` +
          `c'est exactement le défaut du 16 septembre 2026`,
      );
    }
  });

  it('dérive ses hauteurs de la table partagée', () => {
    // Depuis le chantier 13, la source n'est plus `ROW_HEIGHTS` mais
    // `boxRowHeights(n)` : la même table que l'app et la grille web, et elle
    // vaut pour une édition de 2 à 6 cases, pas seulement pour six.
    assert.match(
      text,
      /import\s*\{[^}]*\bboxRowHeights\b[^}]*\}\s*from\s*'@bento-pop\/supabase-mobile\/bento'/s,
      'les hauteurs de rangée doivent venir de la table partagée, seule source',
    );
    assert.doesNotMatch(
      text,
      /const\s+rows\s*=\s*\[\s*1\s*,\s*2\s*,\s*3\s*\]/,
      'un littéral `[1, 2, 3]` ne dit rien de la taille des rangées',
    );
    assert.doesNotMatch(
      text,
      /\bTILE_LAYOUT\b/,
      'la disposition ne se lit plus dans une table propre au web',
    );
  });
});

describe('la boîte remplit exactement sa hauteur', () => {
  /**
   * L'invariant que les hauteurs explicites rendent vrai : rangées et écarts
   * remplissent l'intérieur du cadre, sans vide ni débordement. Faux avec
   * `flex: 1`, qui remplissait bien la hauteur mais pas dans ces proportions.
   */
  it('rangées et écarts valent l’intérieur du cadre', async () => {
    const { DESIGN_HEIGHT, FRAME, ROW_HEIGHTS } = await import('./layout');
    const interieur = DESIGN_HEIGHT - (FRAME.padding + FRAME.border) * 2;
    const rangees = ROW_HEIGHTS.reduce((somme, h) => somme + h, 0);
    const ecarts = FRAME.gap * (ROW_HEIGHTS.length - 1);
    assert.equal(rangees + ecarts, interieur);
  });
});
