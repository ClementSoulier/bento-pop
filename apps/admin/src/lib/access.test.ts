import assert from 'node:assert/strict';
import { test } from 'node:test';

import { decideAccess, deniedRedirect } from './access';

const USER = { id: 'u1', email: 'florian@example.test' };

test('sans session : anonyme, renvoyé vers /login', () => {
  const state = decideAccess(null, { ok: true, role: null });
  assert.deepEqual(state, { kind: 'anonymous' });
  assert.equal(deniedRedirect(state), '/login');
});

test('connecté mais absent de admin_users : refusé, jamais renvoyé vers /login', () => {
  // /login renverrait la session valide vers /, et / vers /login : la boucle du 26/11.
  const state = decideAccess(USER, { ok: true, role: null });
  assert.deepEqual(state, { kind: 'denied', email: 'florian@example.test', reason: 'not_listed' });
  assert.equal(deniedRedirect(state), '/acces-refuse');
});

test('droits impossibles à lire : refusé avec la bonne raison', () => {
  const state = decideAccess(USER, { ok: false });
  assert.deepEqual(state, { kind: 'denied', email: 'florian@example.test', reason: 'unverifiable' });
  assert.equal(deniedRedirect(state), '/acces-refuse');
});

test('admin ou editor : accès accordé', () => {
  for (const role of ['admin', 'editor'] as const) {
    const state = decideAccess(USER, { ok: true, role });
    assert.deepEqual(state, {
      kind: 'admin',
      session: { userId: 'u1', email: 'florian@example.test', role },
    });
    assert.equal(deniedRedirect(state), null);
  }
});

test('un compte sans adresse garde une adresse vide', () => {
  const state = decideAccess({ id: 'u2', email: null }, { ok: true, role: null });
  assert.equal(state.kind === 'denied' && state.email, '');
});
