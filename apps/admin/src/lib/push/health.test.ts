import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatAgo, formatParis, recentError, tickState } from './health';

const maintenant = new Date('2026-09-23T10:00:00Z');

describe('l’état du battement', () => {
  it('jamais reçu : la chaîne n’est pas encore branchée', () => {
    assert.equal(tickState(null, maintenant), 'never');
  });

  it('reçu il y a 4 minutes : en marche', () => {
    assert.equal(tickState('2026-09-23T09:56:00Z', maintenant), 'ok');
  });

  it('reçu il y a 15 minutes pile : encore en marche', () => {
    assert.equal(tickState('2026-09-23T09:45:00Z', maintenant), 'ok');
  });

  it('reçu il y a 16 minutes : en panne, trois battements manqués', () => {
    assert.equal(tickState('2026-09-23T09:44:00Z', maintenant), 'late');
  });
});

describe('les dates de la carte', () => {
  it('le temps écoulé, en mots', () => {
    assert.equal(formatAgo('2026-09-23T09:59:40Z', maintenant), "à l'instant");
    assert.equal(formatAgo('2026-09-23T09:57:00Z', maintenant), 'il y a 3 min');
    assert.equal(formatAgo('2026-09-23T08:00:00Z', maintenant), 'il y a 2 h');
    assert.equal(formatAgo('2026-09-19T10:00:00Z', maintenant), 'il y a 4 j');
  });

  it('une date à venir ne donne pas un temps négatif', () => {
    assert.equal(formatAgo('2026-09-23T10:05:00Z', maintenant), "à l'instant");
  });

  it('l’heure de Paris, pas celle du conteneur', () => {
    // 10 h UTC le 23 septembre, c'est midi à Paris (heure d'été).
    assert.match(formatParis('2026-09-23T10:00:00Z'), /23 sept\.?,? (à )?12:00/);
  });
});

describe('la dernière erreur', () => {
  it('récente, elle s’affiche', () => {
    assert.deepEqual(recentError('2026-09-22T10:00:00Z', 'InvalidCredentials : clé', maintenant), {
      at: '2026-09-22T10:00:00Z',
      message: 'InvalidCredentials : clé',
    });
  });

  it('vieille de plus de 7 jours, elle disparaît', () => {
    assert.equal(recentError('2026-09-15T09:59:00Z', 'InvalidCredentials : clé', maintenant), null);
  });

  it('aucune, rien', () => {
    assert.equal(recentError(null, null, maintenant), null);
  });
});
