import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { busyA11y, checkboxA11y, radioA11y } from './a11y-states';

describe('une case à cocher', () => {
  it('sur iOS, un bouton qui dit en français s’il est coché', () => {
    assert.deepEqual(checkboxA11y(false, 'ios'), {
      role: 'button',
      state: {},
      value: { text: 'non coché' },
    });
    assert.deepEqual(checkboxA11y(true, 'ios').value, { text: 'coché' });
  });

  it('sur iOS, aucun état que React Native traduirait en anglais', () => {
    assert.equal(checkboxA11y(true, 'ios').state.checked, undefined);
  });

  it('sur Android, la case de React Native, dite par TalkBack', () => {
    assert.deepEqual(checkboxA11y(true, 'android'), {
      role: 'checkbox',
      state: { checked: true },
      value: undefined,
    });
  });
});

describe('un choix parmi plusieurs', () => {
  it('sur iOS, un bouton au trait « sélectionné »', () => {
    assert.deepEqual(radioA11y(true, 'ios'), { role: 'button', state: { selected: true } });
    assert.deepEqual(radioA11y(false, 'ios'), { role: 'button', state: { selected: false } });
  });

  it('sur Android, le bouton radio de React Native', () => {
    assert.deepEqual(radioA11y(true, 'android'), { role: 'radio', state: { checked: true } });
  });
});

describe('un bouton qui travaille', () => {
  it('sur iOS, l’état busy disparaît et la valeur dit « en cours »', () => {
    assert.deepEqual(busyA11y({ disabled: true, busy: true }, 'ios'), {
      state: { disabled: true },
      value: { text: 'en cours' },
    });
  });

  it('sur iOS, au repos, aucune valeur', () => {
    assert.deepEqual(busyA11y({ disabled: false, busy: false }, 'ios'), {
      state: { disabled: false },
      value: undefined,
    });
  });

  it('sur Android, l’état tel quel', () => {
    const state = { disabled: true, busy: true };
    assert.deepEqual(busyA11y(state, 'android'), { state, value: undefined });
  });
});
