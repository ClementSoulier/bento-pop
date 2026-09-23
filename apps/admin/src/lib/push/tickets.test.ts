import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readReceipts, readTickets } from './tickets';

describe('la lecture des tickets, juste après l’envoi', () => {
  const envoyes = [{ tokenId: 'a' }, { tokenId: 'b' }, { tokenId: 'c' }];

  it('un ticket accepté se garde pour relire son accusé', () => {
    const lecture = readTickets([{ tokenId: 'a' }], [{ status: 'ok', id: 'ticket-a' }]);
    assert.deepEqual(lecture, {
      accepted: [{ ticketId: 'ticket-a', tokenId: 'a' }],
      revoke: [],
      errors: [],
      unreachable: false,
    });
  });

  it('DeviceNotRegistered révoque l’appareil sans compter comme une panne', () => {
    const lecture = readTickets(envoyes, [
      { status: 'ok', id: 't-a' },
      { status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } },
      { status: 'ok', id: 't-c' },
    ]);
    assert.deepEqual(lecture.revoke, ['b']);
    assert.deepEqual(lecture.errors, []);
    assert.equal(lecture.accepted.length, 2);
  });

  it('une autre erreur va au contrôle de santé, une seule fois', () => {
    const erreur = {
      status: 'error' as const,
      message: 'The Apple Push Notification service key is invalid',
      details: { error: 'InvalidCredentials' },
    };
    const lecture = readTickets(envoyes, [erreur, erreur, { status: 'ok', id: 't-c' }]);
    assert.deepEqual(lecture.errors, [
      'InvalidCredentials : The Apple Push Notification service key is invalid',
    ]);
    assert.deepEqual(lecture.revoke, []);
    assert.equal(lecture.unreachable, false);
  });

  it('toutes les requêtes échouées : Expo était injoignable', () => {
    const echec = { status: 'error' as const, message: 'fetch failed', details: { error: 'RequestFailed' } };
    const lecture = readTickets(envoyes, [echec, echec, echec]);
    assert.equal(lecture.unreachable, true);
    assert.deepEqual(lecture.accepted, []);
  });

  it('un lot passé sur deux : Expo joignable, l’échec se note', () => {
    const echec = { status: 'error' as const, message: 'fetch failed', details: { error: 'RequestFailed' } };
    const lecture = readTickets(envoyes, [{ status: 'ok', id: 't-a' }, echec, echec]);
    assert.equal(lecture.unreachable, false);
    assert.deepEqual(lecture.errors, ['RequestFailed : fetch failed']);
  });

  it('un ticket manquant est une erreur, pas un succès', () => {
    const lecture = readTickets(envoyes, [{ status: 'ok', id: 't-a' }]);
    assert.equal(lecture.accepted.length, 1);
    assert.equal(lecture.errors.length, 1);
  });

  it('rien d’envoyé, rien d’injoignable', () => {
    assert.equal(readTickets([], []).unreachable, false);
  });
});

describe('la lecture des accusés de réception', () => {
  const tickets = [
    { ticketId: 't-ok', tokenId: 'a' },
    { ticketId: 't-perdu', tokenId: 'b' },
    { ticketId: 't-gros', tokenId: 'c' },
    { ticketId: 't-inconnu', tokenId: 'd' },
    { ticketId: 't-pas-encore', tokenId: 'e' },
  ];
  const lecture = readReceipts(tickets, {
    't-ok': { status: 'ok' },
    't-perdu': { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } },
    't-gros': { status: 'error', message: 'payload over 4096 bytes', details: { error: 'MessageTooBig' } },
    't-inconnu': { status: 'error', message: 'Something odd' },
  });

  it('ok se marque relu', () => {
    assert.ok(lecture.checked.some((c) => c.ticketId === 't-ok' && c.status === 'ok'));
  });

  it('DeviceNotRegistered révoque l’appareil (D7)', () => {
    assert.deepEqual(lecture.revoke, ['b']);
    assert.ok(lecture.checked.some((c) => c.ticketId === 't-perdu' && c.status === 'DeviceNotRegistered'));
  });

  it('MessageTooBig et une erreur inconnue vont au contrôle de santé', () => {
    assert.deepEqual(lecture.errors, ['MessageTooBig : payload over 4096 bytes', 'Error : Something odd']);
    assert.ok(lecture.checked.some((c) => c.ticketId === 't-inconnu' && c.status === 'Error'));
  });

  it('un accusé pas encore arrivé attend le battement suivant', () => {
    assert.ok(!lecture.checked.some((c) => c.ticketId === 't-pas-encore'));
    assert.equal(lecture.checked.length, 4);
  });
});
