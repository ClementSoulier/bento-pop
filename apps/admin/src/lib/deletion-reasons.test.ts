import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DELETION_REASONS, REASON_DETAIL_MAX, composeReason } from './deletion-reasons';

describe('composeReason', () => {
  it('rend le libellé seul quand il n\'y a pas de précision', () => {
    const r = composeReason('test', '');
    assert.equal(r.ok, true);
    assert.equal(r.ok && r.reason, 'Compte de test');
  });

  it('accole la précision au libellé', () => {
    const r = composeReason('contenu', '  pseudo   insultant ');
    assert.equal(r.ok && r.reason, 'Contenu inapproprié : pseudo insultant');
  });

  /**
   * « Autre » sans précision ne trace rien, et le seul intérêt du registre
   * est d'expliquer une suppression dont on ne se souviendra plus.
   */
  it('exige une précision derrière « Autre »', () => {
    const r = composeReason('autre', '   ');
    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.error : '', /Précise/);
    assert.equal(composeReason('autre', 'demande du créateur').ok, true);
  });

  it('borne la précision', () => {
    assert.equal(composeReason('test', 'a'.repeat(REASON_DETAIL_MAX)).ok, true);
    assert.equal(composeReason('test', 'a'.repeat(REASON_DETAIL_MAX + 1)).ok, false);
  });

  it('refuse un identifiant inconnu', () => {
    assert.equal(composeReason('inexistant' as never, 'x').ok, false);
  });

  /**
   * Le libellé est recopié en clair dans le registre. Si un libellé
   * dépassait la contrainte SQL de 500 caractères, l'insertion échouerait
   * après coup, au pire moment.
   */
  it('produit un motif qui tient dans la contrainte SQL', () => {
    for (const entry of DELETION_REASONS) {
      const r = composeReason(entry.id, 'a'.repeat(REASON_DETAIL_MAX));
      assert.equal(r.ok, true, entry.id);
      assert.ok((r.ok ? r.reason : '').length <= 500, entry.id);
    }
  });
});
