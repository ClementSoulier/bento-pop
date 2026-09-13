import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions, isUpdateAvailable, shouldOfferUpdate } from './version';

test('compareVersions ordonne les versions', () => {
  assert.equal(compareVersions('1.0.0', '1.0.1'), -1);
  assert.equal(compareVersions('1.0.1', '1.0.0'), 1);
  assert.equal(compareVersions('1.0.0', '1.0.0'), 0);
  assert.equal(compareVersions('0.2.0', '0.10.0'), -1, '10 > 2, pas une comparaison de chaînes');
  assert.equal(compareVersions('2.0.0', '10.0.0'), -1);
});

test('compareVersions tolère les segments manquants', () => {
  assert.equal(compareVersions('1', '1.0.0'), 0);
  assert.equal(compareVersions('1.2', '1.2.0'), 0);
  assert.equal(compareVersions('1.2', '1.2.1'), -1);
});

test('compareVersions ne casse pas sur une chaîne aberrante', () => {
  // getCurrentAppVersion() peut renvoyer '0.0.0', et app_config est saisi à
  // la main dans le back-office : une valeur illisible ne doit pas lever.
  assert.equal(compareVersions('', '0.0.0'), 0);
  assert.equal(compareVersions('abc', '0.0.0'), 0);
  assert.equal(compareVersions('0.0.0', 'x.y.z'), 0);
});

test('isUpdateAvailable : latest absent ne propose rien', () => {
  // Le cas Android en production aujourd'hui : android_latest_version = null.
  assert.equal(isUpdateAvailable('0.2.0', null), false);
  assert.equal(isUpdateAvailable('0.2.0', undefined), false);
  assert.equal(isUpdateAvailable('0.2.0', ''), false);
});

test('isUpdateAvailable : égal ou en avance ne propose rien', () => {
  assert.equal(isUpdateAvailable('0.2.0', '0.2.0'), false);
  // Build interne en avance sur le store : surtout pas d'invitation.
  assert.equal(isUpdateAvailable('0.3.0', '0.2.0'), false);
});

test('isUpdateAvailable : en retard propose', () => {
  assert.equal(isUpdateAvailable('0.2.0', '0.2.1'), true);
  assert.equal(isUpdateAvailable('0.0.1', '0.2.0'), true);
});

test('shouldOfferUpdate : le refus vaut pour la version refusée', () => {
  assert.equal(shouldOfferUpdate('0.2.0', '0.3.0', null), true);
  assert.equal(shouldOfferUpdate('0.2.0', '0.3.0', '0.3.0'), false);
});

test('shouldOfferUpdate : une version plus récente rejoue l’invitation', () => {
  assert.equal(shouldOfferUpdate('0.2.0', '0.4.0', '0.3.0'), true);
});

test('shouldOfferUpdate : un refus périmé ne ressuscite rien', () => {
  // On a refusé 0.3.0 puis on l'a installée : plus rien à proposer.
  assert.equal(shouldOfferUpdate('0.3.0', '0.3.0', '0.3.0'), false);
});
