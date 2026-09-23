import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type PushTokenRow, selectRecipients, staleCutoff } from './recipients';

const maintenant = new Date('2026-09-23T12:00:00Z');
const hier = '2026-09-22T12:00:00Z';

const appareil = (id: string, over: Partial<PushTokenRow> = {}): PushTokenRow => ({
  id,
  user_id: 'auteur',
  token: `ExponentPushToken[${id}]`,
  transactional: true,
  editorial: false,
  last_seen_at: hier,
  revoked_at: null,
  ...over,
});

const ids = (rows: PushTokenRow[]) => rows.map((r) => r.id);

describe('qui reçoit la notification d’un item modéré', () => {
  const audience = { kind: 'item_moderated', authorId: 'auteur' } as const;

  it('les appareils de l’auteur, et seulement les siens', () => {
    const rows = [appareil('iphone'), appareil('ipad'), appareil('autre', { user_id: 'quelqu-un' })];
    assert.deepEqual(ids(selectRecipients(audience, rows, maintenant)), ['iphone', 'ipad']);
  });

  it('pas un appareil révoqué', () => {
    const rows = [appareil('mort', { revoked_at: hier }), appareil('vivant')];
    assert.deepEqual(ids(selectRecipients(audience, rows, maintenant)), ['vivant']);
  });

  it('pas un appareil vu il y a plus de 60 jours (D7)', () => {
    const rows = [
      appareil('perime', { last_seen_at: '2026-07-24T11:59:59Z' }),
      appareil('limite', { last_seen_at: staleCutoff(maintenant).toISOString() }),
    ];
    assert.deepEqual(ids(selectRecipients(audience, rows, maintenant)), ['limite']);
  });

  it('pas un appareil qui a coupé « Mes items »', () => {
    const rows = [appareil('coupe', { transactional: false }), appareil('actif')];
    assert.deepEqual(ids(selectRecipients(audience, rows, maintenant)), ['actif']);
  });

  it('l’accord éditorial ne compte pas pour un item', () => {
    const rows = [appareil('editorial-seul', { transactional: false, editorial: true })];
    assert.deepEqual(selectRecipients(audience, rows, maintenant), []);
  });

  it('sans auteur, personne', () => {
    // Un item saisi au back-office : le déclencheur l'écarte déjà (§6.5).
    const rows = [appareil('iphone')];
    assert.deepEqual(selectRecipients({ kind: 'item_moderated', authorId: null }, rows, maintenant), []);
  });

  it('une date de passage illisible écarte l’appareil', () => {
    const rows = [appareil('illisible', { last_seen_at: 'hier' })];
    assert.deepEqual(selectRecipients(audience, rows, maintenant), []);
  });

  it('un même jeton ne reçoit jamais deux fois', () => {
    const rows = [appareil('a'), { ...appareil('b'), token: 'ExponentPushToken[a]' }];
    assert.deepEqual(ids(selectRecipients(audience, rows, maintenant)), ['a']);
  });
});

describe('qui reçoit l’annonce d’une édition', () => {
  const audience = { kind: 'edition_released' } as const;

  it('ceux qui l’ont accepté, quel que soit leur compte (D6)', () => {
    const rows = [
      appareil('accepte', { editorial: true, user_id: 'x' }),
      appareil('refuse', { editorial: false, user_id: 'y' }),
      appareil('accepte-sans-items', { editorial: true, transactional: false, user_id: 'z' }),
    ];
    assert.deepEqual(ids(selectRecipients(audience, rows, maintenant)), ['accepte', 'accepte-sans-items']);
  });

  it('ni révoqué, ni périmé', () => {
    const rows = [
      appareil('revoque', { editorial: true, revoked_at: hier }),
      appareil('perime', { editorial: true, last_seen_at: '2026-06-01T00:00:00Z' }),
    ];
    assert.deepEqual(selectRecipients(audience, rows, maintenant), []);
  });
});
