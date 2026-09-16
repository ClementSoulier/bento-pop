import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { userErrorMessage } from './user-error-message';

/** Messages réellement levés par l'app, relevés au journal. */
const TECHNIQUES = [
  'Unpublish failed: permission denied for table bentos',
  'Account deletion failed: JSON object requested, multiple (or no) rows returned',
  'Search failed: rpc search_items hors liste blanche (RPC_ALLOW)',
  'Bento create failed: unknown',
];

describe('userErrorMessage', () => {
  it('ne laisse sortir aucune chaîne technique', () => {
    for (const raw of TECHNIQUES) {
      const message = userErrorMessage('unpublish', new Error(raw));
      assert.ok(!message.includes('failed'), message);
      assert.ok(!/[a-z_]+\.[a-z_]+|rpc |permission denied/i.test(message), message);
    }
  });

  it('dit ce qui n’a pas marché, action par action', () => {
    assert.equal(userErrorMessage('publish', new Error('x')), "La publication n'a pas marché. Réessaie.");
    assert.equal(userErrorMessage('unpublish', new Error('x')), "Le retrait n'a pas marché. Réessaie.");
    assert.equal(
      userErrorMessage('search', new Error('x')),
      "La recherche n'a pas abouti. Vérifie ta connexion.",
    );
  });

  /**
   * Les deux formulations relevées au journal, une par plateforme : sans elles,
   * une panne réseau s'annonçait comme un échec de l'action.
   */
  it('reconnaît une panne réseau, sur les deux plateformes', () => {
    const attendu = 'Pas de connexion. Réessaie quand tu es en ligne.';
    for (const raw of [
      'Bento create failed: Error: fetch failed: UnexpectedException: The network connection was lost. (at ExpoModulesCore/Promise.swift:56)',
      'Slot upsert failed: TypeError: Network request failed',
      'Publish failed: AbortError: Aborted',
    ]) {
      assert.equal(userErrorMessage('publish', new Error(raw)), attendu, raw);
    }
  });

  it('dit qu’un pseudo est réservé plutôt que de parler d’échec', () => {
    assert.equal(
      userErrorMessage('create-profile', new Error('Pseudo non autorisé.')),
      "Ce pseudo n'est pas disponible. Choisis-en un autre.",
    );
    // Le même message ailleurs reste l'échec de l'action en cours.
    assert.equal(
      userErrorMessage('publish', new Error('Pseudo non autorisé.')),
      "La publication n'a pas marché. Réessaie.",
    );
  });

  it('lit une erreur qui n’en est pas une', () => {
    assert.equal(userErrorMessage('export', null), "L'export n'a pas abouti. Réessaie dans un instant.");
    assert.equal(userErrorMessage('export', 'oups'), "L'export n'a pas abouti. Réessaie dans un instant.");
  });
});
