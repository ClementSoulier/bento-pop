import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TOAST_DURATION, toastBottom, toastDuration, toastIcon } from './toast-rules';

/** Les toasts de l'app (chantier 31, D7). */
describe('les toasts', () => {
  it('restent au moins 4 s, 6 s avec une action', () => {
    assert.equal(toastDuration(false), TOAST_DURATION.plain);
    assert.equal(toastDuration(true), TOAST_DURATION.action);
    assert.equal(toastDuration(false, 3000), 4000);
    assert.equal(toastDuration(true, 5000), 6000);
  });

  it('gardent une durée plus longue quand l’appel la demande', () => {
    assert.equal(toastDuration(false, 5000), 5000);
    assert.equal(toastDuration(true, 8000), 8000);
    assert.equal(toastDuration(false, Number.NaN), 4000);
  });

  it('disent l’erreur par leur icône, pas par leur couleur', () => {
    assert.equal(toastIcon('danger'), 'warning-circle');
    assert.equal(toastIcon('success'), 'check-circle');
    assert.equal(toastIcon('neutral'), 'check-circle');
  });

  it('se posent 8 au-dessus de la barre, 12 au-dessus de la zone sûre ou du clavier', () => {
    assert.equal(toastBottom({ tabBar: true, insetBottom: 34 }), 91 + 8);
    assert.equal(toastBottom({ tabBar: true, insetBottom: 0 }), 57 + 8);
    assert.equal(toastBottom({ tabBar: false, insetBottom: 34 }), 46);
    assert.equal(toastBottom({ tabBar: true, insetBottom: 34, keyboard: 336 }), 348);
  });
});
