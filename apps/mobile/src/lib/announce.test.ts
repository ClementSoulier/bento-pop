import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { connectionAnnouncement, toastAnnouncement } from './announce';

describe('toastAnnouncement', () => {
  it('annonce le message tel qu’il est écrit', () => {
    assert.equal(toastAnnouncement('Case vidée'), 'Case vidée');
  });

  it('nomme l’action, qui ne dure que le temps du toast', () => {
    assert.equal(
      toastAnnouncement('Film : Inception', 'Annuler'),
      'Film : Inception. Action disponible : Annuler.',
    );
  });

  it('ne dit rien d’un message vide', () => {
    assert.equal(toastAnnouncement('   '), '');
    assert.equal(toastAnnouncement('', 'Annuler'), '');
  });
});

describe('connectionAnnouncement', () => {
  it('dit la perte et le retour', () => {
    assert.equal(connectionAnnouncement(true), 'Pas de connexion');
    assert.equal(connectionAnnouncement(false), 'Connexion rétablie');
  });
});
