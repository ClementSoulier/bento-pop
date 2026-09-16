import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bentoRoute } from './bento-address';

describe('bentoRoute, l’adresse d’un bento dans l’app', () => {
  it('mène le principal à l’adresse du compte', () => {
    // Les 27 liens déjà partagés pointent là : ils ne doivent pas bouger.
    assert.equal(bentoRoute('noxito', 'mon-bento', true), '/u/noxito');
  });

  it('mène un secondaire à son slug', () => {
    assert.equal(bentoRoute('noxito', 'hebdo-38', false), '/u/noxito/hebdo-38');
  });

  it('retombe sur le compte quand le slug manque', () => {
    // Une build ancienne, un cache d’avant la migration : mieux vaut le
    // principal qu’une adresse `/u/noxito/undefined`.
    assert.equal(bentoRoute('noxito'), '/u/noxito');
    assert.equal(bentoRoute('noxito', null, false), '/u/noxito');
    assert.equal(bentoRoute('noxito', undefined, false), '/u/noxito');
  });

  it('ne suppose aucune convention sur le slug du principal', () => {
    // C’est `isPrimary` qui décide, pas le texte du slug : rien n’impose
    // que le principal s’appelle « mon-bento ».
    assert.equal(bentoRoute('noxito', 'archives-2025', true), '/u/noxito');
  });
});
