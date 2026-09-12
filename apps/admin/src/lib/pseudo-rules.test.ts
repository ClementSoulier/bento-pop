import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DISPLAY_NAME_MAX,
  PSEUDO_MAX,
  PSEUDO_MIN,
  checkDisplayName,
  checkPseudoShape,
  explainWriteFailure,
  normalizeDisplayName,
} from './pseudo-rules';

describe('checkPseudoShape', () => {
  it('accepte les pseudos réels de la base', () => {
    for (const p of ['recetteuxt_pop', 'dark_hifus', 'buyt.k', 'abc', 'a'.repeat(PSEUDO_MAX)]) {
      assert.equal(checkPseudoShape(p).ok, true, p);
    }
  });

  it('refuse le vide et les espaces seuls', () => {
    for (const p of ['', '   ', '\t']) {
      const r = checkPseudoShape(p);
      assert.equal(r.ok, false);
      assert.equal(r.ok === false && r.reason, 'vide');
    }
  });

  it('applique les bornes de longueur', () => {
    assert.equal(checkPseudoShape('a'.repeat(PSEUDO_MIN - 1)).ok, false);
    assert.equal(checkPseudoShape('a'.repeat(PSEUDO_MIN)).ok, true);
    assert.equal(checkPseudoShape('a'.repeat(PSEUDO_MAX)).ok, true);
    assert.equal(checkPseudoShape('a'.repeat(PSEUDO_MAX + 1)).ok, false);
  });

  /**
   * Les accents sont le refus qui surprend le plus : « Éléonore » est un nom
   * parfaitement normal, mais la contrainte SQL ne l'accepte pas comme
   * pseudo. Le message doit donc le dire explicitement.
   */
  it('refuse espaces, accents et ponctuation exotique', () => {
    for (const p of ['avec espace', 'éléonore', 'a-b-c', 'hé!', 'emoji🍱']) {
      const r = checkPseudoShape(p);
      assert.equal(r.ok, false, p);
      assert.equal(r.ok === false && r.reason, 'caracteres', p);
    }
    const message = checkPseudoShape('éléonore');
    assert.match(message.ok === false ? message.message : '', /accent/i);
  });

  it('ignore les espaces autour', () => {
    assert.equal(checkPseudoShape('  valide_1  ').ok, true);
  });

  /**
   * Ce test protège l'alignement avec la contrainte SQL `pseudo_format`,
   * `^[A-Za-z0-9_.]{3,20}$`. Élargir la regex ici sans toucher à la base
   * ferait accepter des pseudos que l'insertion refuserait ensuite.
   */
  it('ne laisse passer que le jeu de caractères de la contrainte SQL', () => {
    const allowed = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_.';
    for (const c of allowed) {
      assert.equal(checkPseudoShape(`aa${c}`).ok, true, `caractère ${c} refusé à tort`);
    }
    for (const c of '-+ @/\\#$%&*()[]{}<>?!,;:\'"`~^|=') {
      assert.equal(checkPseudoShape(`aa${c}`).ok, false, `caractère ${c} accepté à tort`);
    }
  });
});

describe('explainWriteFailure', () => {
  /**
   * Les messages viennent de refus réellement observés en production le
   * 12 septembre 2026, en service-role. Les recopier tels quels est le
   * seul moyen d'être sûr que la reconnaissance fonctionne.
   */
  it('reconnaît un doublon insensible à la casse', () => {
    const out = explainWriteFailure({
      code: '23505',
      message:
        'duplicate key value violates unique constraint "users_pseudo_lower_idx"',
    });
    assert.match(out, /déjà pris/);
  });

  it('reconnaît un format invalide', () => {
    const out = explainWriteFailure({
      code: '23514',
      message: 'new row for relation "users" violates check constraint "pseudo_format"',
    });
    assert.match(out, /Format invalide/);
  });

  /**
   * Les deux causes de refus de pseudo partagent le code 23514 et ne se
   * distinguent que par le message. Confondre les deux dirait « format
   * invalide » sur un pseudo parfaitement bien formé mais interdit.
   */
  it('distingue le motif bloqué du format, malgré le même code', () => {
    const out = explainWriteFailure({ code: '23514', message: 'Pseudo non autorisé.' });
    assert.match(out, /motif bloqué/);
    assert.doesNotMatch(out, /Format/);
  });

  it('reconnaît les CGU sur un profil éditorial', () => {
    const out = explainWriteFailure({
      code: '23514',
      message: 'violates check constraint "users_editorial_has_no_terms"',
    });
    assert.match(out, /éditorial/);
  });

  /**
   * Sur un back-office, un message technique inconnu vaut mieux qu'un
   * « une erreur est survenue » : c'est une équipe qui lit, et le message
   * brut est ce qui permet de comprendre.
   */
  it('laisse passer un message inconnu plutôt que de le masquer', () => {
    assert.equal(explainWriteFailure({ code: '42501', message: 'permission denied' }), 'permission denied');
    assert.equal(explainWriteFailure({}), 'La modification a échoué.');
  });
});

describe('nom affiché', () => {
  it('réduit les espaces et rend null quand il ne reste rien', () => {
    assert.equal(normalizeDisplayName('  Dark   Hifus '), 'Dark Hifus');
    assert.equal(normalizeDisplayName('   '), null);
    assert.equal(normalizeDisplayName(''), null);
  });

  it('accepte accents et espaces, contrairement au pseudo', () => {
    assert.equal(checkDisplayName('Éléonore Dupont').ok, true);
  });

  it('applique la borne de longueur', () => {
    assert.equal(checkDisplayName('a'.repeat(DISPLAY_NAME_MAX)).ok, true);
    assert.equal(checkDisplayName('a'.repeat(DISPLAY_NAME_MAX + 1)).ok, false);
  });
});
