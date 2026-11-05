import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { WRAP_LENGTH, balancedLabel } from './button-rules';

describe('le libellé d’un bouton', () => {
  it('ne coupe pas un libellé qui tient sur une ligne', () => {
    assert.equal(balancedLabel('Publier mon bento'), 'Publier mon bento');
    const limit = 'a'.repeat(WRAP_LENGTH - 2) + ' b';
    assert.equal(balancedLabel(limit), limit);
  });

  it('coupe un long libellé à l’espace la plus proche de son milieu', () => {
    assert.equal(
      balancedLabel('Commence par le film que tu reverrais ce soir'),
      'Commence par le film\nque tu reverrais ce soir',
    );
  });

  it('garde intact un long mot sans espace', () => {
    const word = 'a'.repeat(40);
    assert.equal(balancedLabel(word), word);
  });
});
