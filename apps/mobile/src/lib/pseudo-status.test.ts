import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pseudoAddress, pseudoLine } from './pseudo-status';

/** Ce que dit le champ du pseudo (chantier 32, D12). */
describe('la vérification du pseudo', () => {
  it('montre l’adresse tant qu’il n’y a rien à dire', () => {
    assert.deepEqual(pseudoLine('', { status: 'idle' }), {
      kind: 'helper',
      text: 'bento-pop.com/u/ton_pseudo',
    });
    assert.equal(pseudoAddress('  theo  '), 'bento-pop.com/u/theo');
  });

  it('dit qu’elle vérifie, puis « Libre » en succès', () => {
    assert.deepEqual(pseudoLine('theo', { status: 'checking' }), {
      kind: 'helper',
      text: 'On vérifie…',
    });
    assert.deepEqual(pseudoLine('theo', { status: 'available' }), {
      kind: 'success',
      text: 'Libre',
    });
  });

  it('écrit la phrase du guide pour un pseudo pris, avec une suggestion', () => {
    assert.deepEqual(pseudoLine('bento', { status: 'taken' }, 'bento_culture'), {
      kind: 'error',
      text: 'Ce pseudo est déjà pris. Essaie @bento_culture.',
    });
    // Sans suggestion, la phrase s'arrête au constat.
    assert.equal(pseudoLine('bento', { status: 'taken' }).text, 'Ce pseudo est déjà pris.');
  });

  it('dit chaque refus en erreur, avec de quoi s’en sortir', () => {
    const refus = ['reserved', 'forbidden', 'too-short', 'too-long', 'invalid', 'error'] as const;
    for (const status of refus) {
      const line = pseudoLine('x', { status }, 'x_culture');
      assert.equal(line.kind, 'error', status);
      assert.ok(line.text.endsWith('.'), `${status} : ${line.text}`);
      assert.ok(!line.text.includes('undefined'), status);
    }
    assert.equal(
      pseudoLine('ab', { status: 'too-short' }).text,
      'Trop court : 3 caractères au moins.',
    );
    assert.equal(
      pseudoLine('a'.repeat(21), { status: 'too-long' }).text,
      'Trop long : 20 caractères au plus.',
    );
  });
});
