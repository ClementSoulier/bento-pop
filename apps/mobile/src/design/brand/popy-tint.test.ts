import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { POPY_KEYS } from '@bento-pop/supabase-mobile/bento';
import { POPY_TINTS, popyTint } from './popy-tint';

/** La teinte de l'avatar d'un compte, tirée de sa Popy (chantier 31, D6). */
describe('la teinte d’un avatar', () => {
  it('existe pour chacune des six Popys, une teinte chacune', () => {
    assert.deepEqual(Object.keys(POPY_TINTS).sort(), [...POPY_KEYS].sort());
    assert.equal(new Set(Object.values(POPY_TINTS)).size, POPY_KEYS.length);
  });

  it('suit la maquette : « gene » sur shiso, « content » sur yolk', () => {
    assert.equal(popyTint('gene'), 'shiso');
    assert.equal(popyTint('content'), 'yolk');
  });
});
