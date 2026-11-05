import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { selectorRevealOffset } from './selector-reveal';

describe('selectorRevealOffset, la puce active à l’écran', () => {
  const bande = { viewport: 370 };

  it('ramène au début le bento qu’on vient de créer, derrière « Mon bento »', () => {
    assert.equal(selectorRevealOffset({ ...bande, x: 100, width: 120, offset: 300 }), 0);
  });

  it('ne bouge pas une puce déjà visible en entier', () => {
    assert.equal(selectorRevealOffset({ ...bande, x: 0, width: 100, offset: 0 }), null);
    assert.equal(selectorRevealOffset({ ...bande, x: 310, width: 120, offset: 100 }), null);
  });

  it('cale à droite une puce coupée à droite', () => {
    assert.equal(selectorRevealOffset({ ...bande, x: 500, width: 120, offset: 0 }), 250);
  });

  it('cale à gauche une puce coupée à gauche, hors du premier écran', () => {
    assert.equal(selectorRevealOffset({ ...bande, x: 500, width: 120, offset: 600 }), 500);
  });

  it('attend que la bande soit mesurée', () => {
    assert.equal(selectorRevealOffset({ x: 500, width: 120, offset: 0, viewport: 0 }), null);
  });
});
