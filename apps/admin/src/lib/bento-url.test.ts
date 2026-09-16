import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { publicBentoPath, publicBentoUrl } from './bento-url';

describe('publicBentoUrl', () => {
  it('mène le principal à l’adresse du compte', () => {
    // Les liens déjà partagés pointent là : ils ne doivent pas bouger.
    assert.equal(publicBentoUrl('noxito', 'mon-bento', true), 'https://bento-pop.com/u/noxito');
  });

  it('mène un secondaire à son slug', () => {
    assert.equal(
      publicBentoUrl('noxito', 'hebdo-38', false),
      'https://bento-pop.com/u/noxito/hebdo-38',
    );
  });

  it('retombe sur le compte quand le slug manque', () => {
    assert.equal(publicBentoUrl('noxito'), 'https://bento-pop.com/u/noxito');
    assert.equal(publicBentoUrl('noxito', null, false), 'https://bento-pop.com/u/noxito');
  });

  it('ne suppose aucune convention sur le slug du principal', () => {
    assert.equal(publicBentoUrl('noxito', 'archives-2025', true), 'https://bento-pop.com/u/noxito');
  });

  it('rend un chemin sans domaine pour l’affichage', () => {
    assert.equal(publicBentoPath('noxito', 'hebdo-38', false), '/u/noxito/hebdo-38');
    assert.equal(publicBentoPath('noxito'), '/u/noxito');
  });
});
