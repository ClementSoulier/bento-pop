import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PublicBento } from './public-bento';
import { publicPageState, type PublicPageInput } from './public-page-state';

const BENTO: PublicBento = {
  id: '20000000-0000-4000-8000-000000000001',
  slug: 'mon-bento',
  isPrimary: true,
  pseudo: 'Dark_Hifus',
  displayName: null,
  isGuest: false,
  isFeatured: false,
  publishedAt: '2026-09-08T15:49:11.227431+00:00',
  slots: {},
};

const input = (overrides: Partial<PublicPageInput> = {}): PublicPageInput => ({
  ownPseudo: null,
  data: undefined,
  isError: false,
  isFetching: false,
  isOffline: false,
  ...overrides,
});

describe('publicPageState, réponses', () => {
  it('montre le bento trouvé', () => {
    const state = publicPageState(
      input({ data: { pseudo: 'Dark_Hifus', bento: BENTO, others: [] } }),
    );
    assert.deepEqual(state, { kind: 'found', bento: BENTO, isOwn: false, others: [] });
  });

  it('dit « introuvable » pour un pseudo qui n’existe pas', () => {
    assert.deepEqual(publicPageState(input({ data: null })), { kind: 'not-found' });
  });

  it('dit « rien en ligne » pour un compte sans bento publié', () => {
    const state = publicPageState(
      input({ data: { pseudo: 'keremasan', bento: null, others: [] } }),
    );
    assert.deepEqual(state, {
      kind: 'nothing-online',
      pseudo: 'keremasan',
      isOwn: false,
      others: [],
    });
  });

  /**
   * Le seul état qu'aucune recette sur simulateur n'atteint sans créer de
   * compte en production : d'où ce test.
   */
  it('reconnaît sa propre page sans bento, à la casse près', () => {
    const state = publicPageState(
      input({ ownPseudo: 'KEREMASAN', data: { pseudo: 'keremasan', bento: null, others: [] } }),
    );
    assert.deepEqual(state, {
      kind: 'nothing-online',
      pseudo: 'keremasan',
      isOwn: true,
      others: [],
    });
  });

  it('reconnaît son propre bento, et seulement le sien', () => {
    const own = publicPageState(
      input({ ownPseudo: 'dark_hifus', data: { pseudo: 'Dark_Hifus', bento: BENTO, others: [] } }),
    );
    assert.equal(own.kind === 'found' && own.isOwn, true);

    const other = publicPageState(
      input({ ownPseudo: 'keremasan', data: { pseudo: 'Dark_Hifus', bento: BENTO, others: [] } }),
    );
    assert.equal(other.kind === 'found' && other.isOwn, false);

    const anonymous = publicPageState(
      input({ ownPseudo: '', data: { pseudo: 'Dark_Hifus', bento: BENTO, others: [] } }),
    );
    assert.equal(anonymous.kind === 'found' && anonymous.isOwn, false);
  });
});

describe('publicPageState, chargement et pannes', () => {
  it('montre le squelette pendant le premier chargement', () => {
    assert.deepEqual(publicPageState(input({ isFetching: true })), { kind: 'loading' });
  });

  it('dit « Connexion perdue » tout de suite hors ligne, sans attendre la requête', () => {
    assert.deepEqual(publicPageState(input({ isFetching: true, isOffline: true })), {
      kind: 'unreachable',
    });
  });

  it('dit « Connexion perdue » quand la requête a échoué', () => {
    assert.deepEqual(publicPageState(input({ isError: true })), { kind: 'unreachable' });
  });

  it('remontre le squelette quand « Réessayer » relance la requête', () => {
    assert.deepEqual(publicPageState(input({ isError: true, isFetching: true })), {
      kind: 'loading',
    });
  });

  /**
   * Un bento déjà vu reste affiché : hors ligne, ou quand son rafraîchissement
   * en arrière-plan échoue. L'effacer pour « Connexion perdue » retirerait ce
   * que la personne regardait.
   */
  it('garde une réponse déjà reçue, hors ligne comme après un rafraîchissement raté', () => {
    const data = { pseudo: 'Dark_Hifus', bento: BENTO, others: [] };
    assert.equal(publicPageState(input({ data, isOffline: true })).kind, 'found');
    assert.equal(publicPageState(input({ data, isError: true })).kind, 'found');
    assert.equal(publicPageState(input({ data: null, isOffline: true })).kind, 'not-found');
  });
});
