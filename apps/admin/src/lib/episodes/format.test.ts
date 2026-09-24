import assert from 'node:assert/strict';
import { test } from 'node:test';

import { datetimeLocalToIso, isoToDatetimeLocal } from './format';

test('une date déjà convertie en ISO passe le serveur sans décalage', () => {
  // Le navigateur convertit, le serveur reconvertit : la seconde passe ne doit rien changer.
  for (const saisie of ['2026-09-22T18:00', '2026-01-09T09:56', '2026-03-29T02:30']) {
    const navigateur = datetimeLocalToIso(saisie);
    assert.ok(navigateur);
    assert.equal(datetimeLocalToIso(navigateur), navigateur);
  }
});

test('une date relue puis réenregistrée telle quelle ne bouge pas', () => {
  // Relire une fiche et l'enregistrer sans rien toucher : la date doit rester à la seconde près.
  for (const enBase of ['2026-09-22T16:00:00.000Z', '2026-09-15T11:25:55.000Z']) {
    assert.equal(datetimeLocalToIso(isoToDatetimeLocal(enBase)), enBase);
  }
});

test('un champ vide reste vide', () => {
  assert.equal(datetimeLocalToIso(''), null);
  assert.equal(datetimeLocalToIso('   '), null);
  assert.equal(isoToDatetimeLocal(null), '');
});
