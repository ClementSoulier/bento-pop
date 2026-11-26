import assert from 'node:assert/strict';
import { test } from 'node:test';

import { filterSubscribers, sourceLabel, subscribersCsv, type SubscriberRow } from './newsletter';

const rows: SubscriberRow[] = [
  { id: '1', email: 'alice@exemple.fr', source: 'home', consent_at: '2026-11-26T19:00:00+00:00' },
  { id: '2', email: 'Bob@Exemple.FR', source: 'footer', consent_at: '2026-11-25T08:30:00.123+00:00' },
];

test('le CSV met l’adresse d’abord, en CRLF', () => {
  assert.equal(
    subscribersCsv(rows),
    'email,inscrit_le,provenance\r\n' +
      'alice@exemple.fr,2026-11-26T19:00:00.000Z,Accueil\r\n' +
      'Bob@Exemple.FR,2026-11-25T08:30:00.123Z,Pied de page\r\n',
  );
});

test('une cellule à séparateur passe entre guillemets', () => {
  const odd: SubscriberRow = { id: '3', email: '"a,b"@exemple.fr', source: 'x', consent_at: '2026-01-01T00:00:00Z' };
  assert.equal(
    subscribersCsv([odd]).split('\r\n')[1],
    '"""a,b""@exemple.fr",2026-01-01T00:00:00.000Z,x',
  );
});

test('le CSV d’une liste vide garde son en-tête', () => {
  assert.equal(subscribersCsv([]), 'email,inscrit_le,provenance\r\n');
});

test('la recherche ignore la casse et les espaces', () => {
  assert.deepEqual(filterSubscribers(rows, '  BOB ').map((r) => r.id), ['2']);
  assert.deepEqual(filterSubscribers(rows, '').map((r) => r.id), ['1', '2']);
  assert.deepEqual(filterSubscribers(rows, 'zzz'), []);
});

test('les provenances ont un nom lisible', () => {
  assert.equal(sourceLabel('home'), 'Accueil');
  assert.equal(sourceLabel('footer'), 'Pied de page');
  assert.equal(sourceLabel('autre'), 'autre');
});
