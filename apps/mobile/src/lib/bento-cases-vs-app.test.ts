import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { CATEGORY_META, CATEGORY_ORDER } from '@bento-pop/supabase-mobile/bento';

/**
 * La base et l'app disent la même chose des six cases du bento principal.
 *
 * Deux sources coexistent volontairement, et cette coexistence est une
 * décision, pas un oubli :
 *
 * - **l'app compile ses six cases** (`CATEGORY_META`, `CATEGORY_ORDER`), parce
 *   que toute version déjà déployée en dépend et qu'aucune ne sait lire une
 *   case en base. C'est le D8 du chantier 15 ;
 * - **la base les porte aussi** depuis le chantier 13, parce qu'une case
 *   d'édition n'existe pas à la compilation : elle doit venir du serveur, et
 *   les six ne peuvent pas être l'exception du format.
 *
 * Deux sources qui doivent rester d'accord se séparent toujours, sauf si
 * quelque chose échoue quand elles le font. C'est ce que fait ce test.
 *
 * **Il lit le SQL plutôt que la base** : les tests tournent en CI sans
 * Postgres, et un test qui ne tourne qu'en local ne garde rien. La migration
 * est la source de ce que la base contiendra, donc la lire suffit.
 */

const MIGRATION = join(
  __dirname,
  '..',
  '..',
  'supabase',
  'migrations',
  '20260917100000_editions.sql',
);

/** Les lignes `('clé', 'prompt', 'TAMPON', 'genre'),` du remplissage. */
function casesDuSql(sql: string): Map<string, { prompt: string; stamp: string; gender: string }> {
  const debut = sql.indexOf('set prompt = v.prompt');
  assert.ok(debut > 0, 'le remplissage des six cases est introuvable dans la migration');
  const fin = sql.indexOf('as v(case_key', debut);
  assert.ok(fin > debut, 'la fin du remplissage est introuvable');

  const bloc = sql.slice(debut, fin);
  const lignes = [...bloc.matchAll(/\('([^']+)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)'\)/g)];
  return new Map(
    lignes.map(([, key, prompt, stamp, gender]) => [
      key as string,
      { prompt: prompt as string, stamp: stamp as string, gender: gender as string },
    ]),
  );
}

describe('les six cases, en base et dans l’app', () => {
  const sql = readFileSync(MIGRATION, 'utf8');
  const enBase = casesDuSql(sql);

  it('couvre exactement les six cases de l’app', () => {
    assert.deepEqual([...enBase.keys()].sort(), [...CATEGORY_ORDER].sort());
  });

  for (const key of CATEGORY_ORDER) {
    it(`dit la même chose de « ${key} »`, () => {
      const base = enBase.get(key);
      const app = CATEGORY_META[key];
      assert.ok(base, `la migration ne remplit pas la case ${key}`);
      assert.equal(base.prompt, app.label, `prompt de ${key}`);
      assert.equal(base.stamp, app.stamp, `tampon de ${key}`);
      assert.equal(base.gender, app.gender, `genre de ${key}`);
    });
  }

  /**
   * Témoin. Si le remplissage est réécrit sous une autre forme, l'extraction
   * rendrait une table vide et les tests ci-dessus passeraient sans rien
   * comparer.
   */
  it('a bien lu six lignes dans le SQL', () => {
    assert.equal(enBase.size, 6);
  });
});
