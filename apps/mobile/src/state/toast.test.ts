import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { useToast } from './toast';

/** La file des toasts (chantier 31, D7). */
describe('la file des toasts', () => {
  it('garde la forme des appels de l’app, l’icône en plus', () => {
    const onPress = () => {};
    useToast.getState().show('Case vidée', {
      variant: 'neutral',
      durationMs: 5000,
      action: { label: 'Annuler', onPress },
    });
    const s = useToast.getState();
    assert.equal(s.message, 'Case vidée');
    assert.equal(s.variant, 'neutral');
    assert.equal(s.durationMs, 5000);
    assert.equal(s.action?.label, 'Annuler');
    assert.equal(s.icon, null);
    useToast.getState().show('On te le rappelle demain à 18 h.', { icon: 'bell-ringing' });
    assert.equal(useToast.getState().icon, 'bell-ringing');
    assert.equal(useToast.getState().durationMs, null);
  });

  it('remplace un toast par le suivant, que l’ancien ne retire pas en partant', () => {
    useToast.getState().show('Compte gardé');
    const first = useToast.getState().seq;
    useToast.getState().show('Nom enregistré');
    useToast.getState().dismiss(first);
    assert.equal(useToast.getState().message, 'Nom enregistré');
    useToast.getState().dismiss(useToast.getState().seq);
    assert.equal(useToast.getState().message, null);
  });
});
