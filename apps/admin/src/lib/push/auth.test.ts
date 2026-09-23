import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isAuthorizedPushCall } from './auth';
import { isPushWebhookPath } from './paths';

describe('le jeton porteur des routes d’envoi', () => {
  const attendu = 'jeton-du-coffre-1234';

  it('le bon jeton passe', () => {
    assert.equal(isAuthorizedPushCall(`Bearer ${attendu}`, attendu), true);
  });

  it('sans en-tête, refusé', () => {
    assert.equal(isAuthorizedPushCall(null, attendu), false);
  });

  it('un faux jeton de même longueur, refusé', () => {
    assert.equal(isAuthorizedPushCall('Bearer jeton-du-coffre-9999', attendu), false);
  });

  it('un jeton de longueur différente, refusé sans lever', () => {
    // `timingSafeEqual` lève sur deux tampons de tailles différentes : les
    // empreintes évitent l'exception, et une réponse 500 qui dirait la taille.
    assert.equal(isAuthorizedPushCall('Bearer court', attendu), false);
    assert.equal(isAuthorizedPushCall(`Bearer ${attendu}${attendu}`, attendu), false);
  });

  it('un autre schéma, ou un porteur vide, refusé', () => {
    assert.equal(isAuthorizedPushCall(`Basic ${attendu}`, attendu), false);
    assert.equal(isAuthorizedPushCall('Bearer ', attendu), false);
    assert.equal(isAuthorizedPushCall(attendu, attendu), false);
  });

  it('sans jeton configuré côté serveur, tout est refusé', () => {
    // Une variable Coolify oubliée ne doit pas ouvrir la route.
    assert.equal(isAuthorizedPushCall('Bearer ', undefined), false);
    assert.equal(isAuthorizedPushCall('Bearer undefined', undefined), false);
    assert.equal(isAuthorizedPushCall('Bearer ', ''), false);
  });
});

describe('les routes que le middleware laisse passer', () => {
  it('les deux routes d’envoi', () => {
    assert.equal(isPushWebhookPath('/api/push'), true);
    assert.equal(isPushWebhookPath('/api/push/tick'), true);
  });

  it('rien d’autre, même d’un nom voisin', () => {
    assert.equal(isPushWebhookPath('/api/pushes'), false);
    assert.equal(isPushWebhookPath('/api'), false);
    assert.equal(isPushWebhookPath('/catalogue'), false);
    assert.equal(isPushWebhookPath('/'), false);
  });
});
