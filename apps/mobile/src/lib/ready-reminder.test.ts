import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ComposeCta } from './compose-cta';
import {
  DRAFT_REMINDER_KEY,
  REMINDER_ASK_MESSAGE,
  REMINDER_LINK_LABEL,
  REMINDER_TITLE,
  nextReminderDate,
  readyReminderKey,
  reminderBody,
  reminderIdentifier,
  reminderKeyFromIdentifier,
  reminderWhenLabel,
  remindersToCancel,
  shouldOfferReminder,
} from './ready-reminder';

// L'heure du téléphone : celle de Paris, comme l'équipe et presque tous les
// comptes. Chaque fichier de test tourne dans son propre processus.
process.env.TZ = 'Europe/Paris';

const BENTO = '3f2b8c1e-5d4a-4b6f-9e0d-1a2b3c4d5e6f';
const AUTRE = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

const pret = (over: Partial<Parameters<typeof readyReminderKey>[0]> = {}) =>
  readyReminderKey({
    cta: 'publish',
    hydrated: true,
    hasProfile: true,
    current: { id: BENTO, firstPublishedAt: null },
    ...over,
  });

describe('readyReminderKey', () => {
  it('rend le bento édité, complet et jamais publié', () => {
    assert.equal(pret(), BENTO);
  });

  it('rend le brouillon d’un compte sans profil', () => {
    assert.equal(pret({ hasProfile: false, current: null }), DRAFT_REMINDER_KEY);
  });

  it('écarte un bento dépublié : son auteur l’a retiré', () => {
    assert.equal(pret({ current: { id: BENTO, firstPublishedAt: '2026-10-01T08:00:00Z' } }), null);
  });

  it('écarte tout ce que le composer ne dit pas « Publier mon bento »', () => {
    const autres: ComposeCta['kind'][] = [
      'busy',
      'open-slot',
      'blocked',
      'awaiting-validation',
      'publish-on-validation',
      'view-public',
    ];
    for (const cta of autres) assert.equal(pret({ cta }), null, cta);
  });

  it('attend la première lecture du bento', () => {
    assert.equal(pret({ hydrated: false }), null);
    assert.equal(pret({ current: null }), null);
  });
});

describe('shouldOfferReminder', () => {
  const peut = { granted: false, canAskAgain: true };

  it('propose pour un bento prêt, pas encore répondu, quand le système peut demander', () => {
    assert.equal(shouldOfferReminder({ readyKey: BENTO, answered: false, permission: peut }), true);
    assert.equal(
      shouldOfferReminder({
        readyKey: BENTO,
        answered: false,
        permission: { granted: true, canAskAgain: false },
      }),
      true,
    );
  });

  it('ne propose qu’une fois par bento', () => {
    assert.equal(shouldOfferReminder({ readyKey: BENTO, answered: true, permission: peut }), false);
  });

  it('ne propose rien que le système ne laisserait pas arriver', () => {
    assert.equal(
      shouldOfferReminder({
        readyKey: BENTO,
        answered: false,
        permission: { granted: false, canAskAgain: false },
      }),
      false,
    );
    assert.equal(
      shouldOfferReminder({ readyKey: BENTO, answered: false, permission: null }),
      false,
    );
    assert.equal(shouldOfferReminder({ readyKey: null, answered: false, permission: peut }), false);
  });
});

describe('nextReminderDate', () => {
  const at = (iso: string) => nextReminderDate(new Date(iso));
  const local = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;

  it('rappelle le lendemain à 18 h un départ de la journée ou de la soirée', () => {
    assert.equal(local(at('2026-10-20T10:00:00+02:00')), '2026-10-21 18:00');
    assert.equal(local(at('2026-10-20T20:00:00+02:00')), '2026-10-21 18:00');
    assert.equal(local(at('2026-10-20T23:59:00+02:00')), '2026-10-21 18:00');
  });

  it('rappelle le jour même un départ en pleine nuit, 12 heures au moins plus tard', () => {
    assert.equal(local(at('2026-10-21T03:00:00+02:00')), '2026-10-21 18:00');
    assert.equal(local(at('2026-10-21T06:00:00+02:00')), '2026-10-21 18:00');
    assert.equal(local(at('2026-10-21T06:00:01+02:00')), '2026-10-22 18:00');
  });

  it('garde 18 h au passage à l’heure d’hiver, le 25 octobre 2026', () => {
    const date = at('2026-10-24T20:00:00+02:00');
    assert.equal(local(date), '2026-10-25 18:00');
    assert.equal(date.toISOString(), '2026-10-25T17:00:00.000Z');
  });

  it('garde 18 h au passage à l’heure d’été, le 28 mars 2027', () => {
    const date = at('2027-03-27T20:00:00+01:00');
    assert.equal(local(date), '2027-03-28 18:00');
    assert.equal(date.toISOString(), '2027-03-28T16:00:00.000Z');
  });
});

describe('les textes', () => {
  it('dit quand le rappel tombera', () => {
    const now = new Date('2026-10-20T10:00:00+02:00');
    assert.equal(reminderWhenLabel(now, nextReminderDate(now)), 'demain à 18 h');
    const nuit = new Date('2026-10-21T03:00:00+02:00');
    assert.equal(reminderWhenLabel(nuit, nextReminderDate(nuit)), "aujourd'hui à 18 h");
  });

  it('tient le titre sous les 28 caractères qu’une notification montre', () => {
    assert.ok(REMINDER_TITLE.length <= 28, `${REMINDER_TITLE.length} caractères`);
  });

  it('nomme un bento secondaire ou d’édition, pas le principal ni le brouillon', () => {
    assert.equal(reminderBody(null), "Publie-le pour qu'il rejoigne La table.");
    assert.equal(
      reminderBody({ isPrimary: true, name: 'Mon bento' }),
      "Publie-le pour qu'il rejoigne La table.",
    );
    assert.equal(
      reminderBody({ isPrimary: false, name: 'Le duel du samedi' }),
      "« Le duel du samedi » n'attend plus que toi : publie-le pour qu'il rejoigne La table.",
    );
  });

  it('n’écrit aucun tiret cadratin', () => {
    for (const text of [
      REMINDER_TITLE,
      REMINDER_ASK_MESSAGE,
      REMINDER_LINK_LABEL,
      reminderBody(null),
    ]) {
      assert.ok(!text.includes('\u2014'), text);
    }
  });
});

describe('les identifiants', () => {
  it('retrouve la clé d’un rappel, et rien pour une autre notification', () => {
    assert.equal(reminderKeyFromIdentifier(reminderIdentifier(BENTO)), BENTO);
    assert.equal(
      reminderKeyFromIdentifier(reminderIdentifier(DRAFT_REMINDER_KEY)),
      DRAFT_REMINDER_KEY,
    );
    assert.equal(reminderKeyFromIdentifier('8b5e6f1a-expo-notification'), null);
    assert.equal(reminderKeyFromIdentifier('ready-bento:'), null);
  });
});

describe('remindersToCancel', () => {
  const base = {
    hasProfile: true,
    ownKnown: true,
    own: [
      { id: BENTO, publishedAt: null, firstPublishedAt: null },
      { id: AUTRE, publishedAt: null, firstPublishedAt: null },
    ],
    editedKey: BENTO,
    readyKey: BENTO,
  };

  it('garde le rappel d’un bento toujours prêt, et celui d’un autre bento pas relu', () => {
    assert.deepEqual(remindersToCancel({ ...base, scheduledKeys: [BENTO, AUTRE] }), []);
  });

  it('annule le rappel d’un bento édité qui a cessé d’être prêt', () => {
    assert.deepEqual(remindersToCancel({ ...base, readyKey: null, scheduledKeys: [BENTO] }), [
      BENTO,
    ]);
  });

  it('annule le rappel d’un bento publié, ou dépublié depuis', () => {
    const own = [{ id: BENTO, publishedAt: null, firstPublishedAt: '2026-10-21T16:00:00Z' }];
    assert.deepEqual(remindersToCancel({ ...base, own, readyKey: null, scheduledKeys: [BENTO] }), [
      BENTO,
    ]);
  });

  it('annule le rappel d’un bento que le compte n’a plus', () => {
    assert.deepEqual(remindersToCancel({ ...base, own: [], scheduledKeys: [BENTO] }), [BENTO]);
  });

  it('n’annule aucun bento en base tant que la liste du compte n’est pas lue', () => {
    assert.deepEqual(
      remindersToCancel({ ...base, ownKnown: false, own: [], scheduledKeys: [BENTO] }),
      [],
    );
  });

  it('annule le brouillon devenu un bento publié, et le brouillon qui n’est plus prêt', () => {
    assert.deepEqual(remindersToCancel({ ...base, scheduledKeys: [DRAFT_REMINDER_KEY] }), [
      DRAFT_REMINDER_KEY,
    ]);
    assert.deepEqual(
      remindersToCancel({
        ...base,
        hasProfile: false,
        own: [],
        editedKey: null,
        readyKey: null,
        scheduledKeys: [DRAFT_REMINDER_KEY],
      }),
      [DRAFT_REMINDER_KEY],
    );
  });

  it('garde le brouillon toujours prêt, et ne décide rien avant la première lecture', () => {
    const sansProfil = { ...base, hasProfile: false, own: [], scheduledKeys: [DRAFT_REMINDER_KEY] };
    assert.deepEqual(
      remindersToCancel({ ...sansProfil, editedKey: null, readyKey: DRAFT_REMINDER_KEY }),
      [],
    );
    assert.deepEqual(
      remindersToCancel({ ...sansProfil, editedKey: undefined, readyKey: null }),
      [],
    );
  });
});
