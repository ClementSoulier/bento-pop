import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { NotificationRow } from '@/supabase/types';
import {
  NOTIFICATION_PAGE,
  badgeText,
  notificationAccessibilityLabel,
  notificationCursor,
  notificationSections,
  notificationsTabLabel,
  seenUntil,
  toNotification,
  type NotificationViewer,
} from './notifications';

const BENTO = '6c1f2a3b-4d5e-4f60-8a9b-0c1d2e3f4a5b';
const ITEM = '2b3c4d5e-6f70-4a8b-9c0d-1e2f3a4b5c6d';
const KEPT = '7d8e9f0a-1b2c-4d3e-8f4a-5b6c7d8e9f0a';
const viewer: NotificationViewer = { id: 'f0e1d2c3-b4a5-4968-8776-655443322110', pseudo: 'alice' };

function row(overrides: Partial<NotificationRow> = {}): NotificationRow {
  return {
    kind: 'like',
    group_key: `like:${BENTO}`,
    is_new: true,
    latest_at: '2026-10-27T10:00:00.000Z',
    events: 1,
    actors: 0,
    actor_pseudos: [],
    actor_avatar: null,
    bento_id: BENTO,
    bento_slug: 'mon-bento',
    bento_primary: true,
    edition_title: null,
    owner_pseudo: 'alice',
    item_id: null,
    kept_item_id: null,
    item_status: null,
    item_titles: [],
    detail: null,
    ...overrides,
  };
}

const text = (r: NotificationRow) => toNotification(r, viewer).text;

describe('les phrases', () => {
  it('un like ne nomme personne, au singulier comme au pluriel (D7)', () => {
    assert.equal(text(row()), '1 personne a aimé ton bento');
    assert.equal(text(row({ events: 3 })), '3 personnes ont aimé ton bento');
    assert.equal(text(row({ events: 1234 })), '1 234 personnes ont aimé ton bento');
    const n = toNotification(row({ events: 3, actor_pseudos: ['bob'] }), viewer);
    assert.ok(!n.text.includes('bob'));
    assert.deepEqual(n.avatar, { kind: 'like' });
  });

  it('un bento d\'édition se nomme par son titre (D24)', () => {
    assert.equal(text(row({ edition_title: 'Le film de ta vie' })), '1 personne a aimé ton bento « Le film de ta vie »');
  });

  it('les commentaires : un, deux, puis le plus récent et les autres', () => {
    const base = { kind: 'comment' as const, group_key: `comment:${BENTO}`, detail: 'Trop bien' };
    assert.equal(text(row({ ...base, actors: 1, events: 2, actor_pseudos: ['bob'] })), '@bob a commenté ton bento : « Trop bien »');
    assert.equal(
      text(row({ ...base, actors: 2, events: 2, actor_pseudos: ['bob', 'lea.cine'] })),
      '@bob et @lea.cine ont commenté ton bento : « Trop bien »',
    );
    assert.equal(
      text(row({ ...base, actors: 4, events: 6, actor_pseudos: ['bob', 'lea.cine'] })),
      '@bob et 3 autres ont commenté ton bento : « Trop bien »',
    );
    assert.equal(text(row({ ...base, actors: 1, actor_pseudos: ['bob'], detail: null })), '@bob a commenté ton bento');
  });

  it('les pseudos sont en gras', () => {
    const n = toNotification(row({ kind: 'comment', actors: 2, actor_pseudos: ['bob', 'eve'], detail: 'Oui' }), viewer);
    assert.deepEqual(
      n.parts.filter((p) => p.strong).map((p) => p.text),
      ['@bob', '@eve'],
    );
  });

  it('un long commentaire s\'arrête sur une ellipse, sur une ligne', () => {
    const long = `${'mot '.repeat(40)}fin`;
    const t = text(row({ kind: 'comment', actors: 1, actor_pseudos: ['bob'], detail: `ligne\n${long}` }));
    const quote = t.slice(t.indexOf('« ') + 2, t.lastIndexOf(' »'));
    assert.ok(quote.length <= 80, String(quote.length));
    assert.ok(quote.endsWith('…'));
    assert.ok(!quote.includes('\n'));
  });

  it('les abonnés et les demandes', () => {
    assert.equal(text(row({ kind: 'follow', group_key: 'follow', actors: 1, actor_pseudos: ['bob'] })), '@bob te suit');
    assert.equal(
      text(row({ kind: 'follow', group_key: 'follow', actors: 2, actor_pseudos: ['bob', 'eve'] })),
      '@bob et @eve te suivent',
    );
    assert.equal(
      text(row({ kind: 'follow', group_key: 'follow', actors: 5, actor_pseudos: ['bob', 'eve'] })),
      '@bob et 4 autres te suivent',
    );
    assert.equal(
      text(row({ kind: 'follow_request', group_key: 'follow_request', actors: 1, actor_pseudos: ['bob'] })),
      '@bob demande à te suivre',
    );
    assert.equal(
      text(row({ kind: 'follow_request', group_key: 'follow_request', actors: 3, actor_pseudos: ['bob', 'eve'] })),
      '@bob et 2 autres demandent à te suivre',
    );
  });

  it('deux auteurs dont un seul nommé : le singulier de « autre »', () => {
    assert.equal(text(row({ kind: 'follow', actors: 2, actor_pseudos: ['bob'] })), '@bob et 1 autre te suivent');
  });

  it('le bento d\'un compte suivi', () => {
    const r = row({ kind: 'followed_bento', owner_pseudo: 'lea.cine', actors: 1, actor_pseudos: ['lea.cine'] });
    assert.equal(text(r), '@lea.cine a publié son bento');
    assert.equal(text({ ...r, edition_title: 'Le film de ta vie' }), '@lea.cine a publié son bento « Le film de ta vie »');
  });

  it('les items validés : un, deux, puis les autres comptés', () => {
    const base = { kind: 'item_validated' as const, group_key: 'item_validated', bento_id: null, owner_pseudo: null };
    assert.equal(text(row({ ...base, events: 1, item_titles: ['Dune'] })), 'Ton item « Dune » est validé');
    assert.equal(text(row({ ...base, events: 2, item_titles: ['Dune', 'Akira'] })), 'Tes items « Dune » et « Akira » sont validés');
    assert.equal(
      text(row({ ...base, events: 3, item_titles: ['Dune', 'Akira'] })),
      'Tes items « Dune », « Akira » et 1 autre sont validés',
    );
    assert.equal(
      text(row({ ...base, events: 5, item_titles: ['Dune', 'Akira'] })),
      'Tes items « Dune », « Akira » et 3 autres sont validés',
    );
  });

  it('un refus, avec ou sans motif', () => {
    const base = { kind: 'item_rejected' as const, events: 1, item_titles: ['Duen'] };
    assert.equal(text(row({ ...base, detail: 'Faute de frappe' })), 'Ton item « Duen » est refusé : Faute de frappe');
    assert.equal(text(row(base)), 'Ton item « Duen » est refusé');
  });

  it('le bento publié à la validation (18)', () => {
    assert.equal(text(row({ kind: 'bento_published' })), 'Ton bento est publié : tous ses items sont validés');
    assert.equal(
      text(row({ kind: 'bento_published', edition_title: 'Été' })),
      'Ton bento « Été » est publié : tous ses items sont validés',
    );
  });

  it('les masquages de l\'équipe, avec leur motif', () => {
    assert.equal(
      text(row({ kind: 'comment_hidden', owner_pseudo: 'bob', detail: 'Hors sujet' })),
      "L'équipe a masqué ton commentaire sur le bento de @bob : Hors sujet",
    );
    assert.equal(
      text(row({ kind: 'comment_hidden', owner_pseudo: 'alice', detail: null })),
      "L'équipe a masqué ton commentaire sur ton bento",
    );
    assert.equal(
      text(row({ kind: 'why_hidden', item_titles: ['Dune'], detail: 'Insultant' })),
      "L'équipe a masqué ton pourquoi sur « Dune » : Insultant",
    );
    assert.deepEqual(toNotification(row({ kind: 'why_hidden' }), viewer).avatar, { kind: 'team' });
  });
});

describe('les destinations (§5)', () => {
  const target = (r: NotificationRow) => toNotification(r, viewer).target;

  it('un like ouvre la page du bento, principal ou non', () => {
    assert.deepEqual(target(row()), { kind: 'page', href: '/u/alice' });
    assert.deepEqual(target(row({ bento_primary: false, bento_slug: 'ete' })), { kind: 'page', href: '/u/alice/ete' });
  });

  it('un commentaire, et un commentaire masqué, ouvrent les commentaires', () => {
    assert.deepEqual(target(row({ kind: 'comment' })), { kind: 'comments', bentoId: BENTO });
    assert.deepEqual(target(row({ kind: 'comment_hidden', owner_pseudo: 'bob' })), { kind: 'comments', bentoId: BENTO });
  });

  it('un abonné et une demande ouvrent ses abonnés', () => {
    assert.deepEqual(target(row({ kind: 'follow', bento_id: null })), { kind: 'followers', userId: viewer.id, pseudo: 'alice' });
    assert.deepEqual(target(row({ kind: 'follow_request', bento_id: null })), {
      kind: 'followers',
      userId: viewer.id,
      pseudo: 'alice',
    });
  });

  it('le bento d\'un compte suivi ouvre sa page', () => {
    assert.deepEqual(target(row({ kind: 'followed_bento', owner_pseudo: 'lea.cine', bento_primary: false, bento_slug: 'ete' })), {
      kind: 'page',
      href: '/u/lea.cine/ete',
    });
  });

  it('les décisions sur les items suivent le tap du push (D10)', () => {
    assert.deepEqual(target(row({ kind: 'item_validated', item_id: ITEM, item_status: 'validated' })), {
      kind: 'push',
      target: { kind: 'item', status: 'validated', itemId: ITEM, keptItemId: null, publishedBentoId: null },
    });
    assert.deepEqual(target(row({ kind: 'item_validated', item_id: ITEM, kept_item_id: KEPT, item_status: 'merged' })), {
      kind: 'push',
      target: { kind: 'item', status: 'merged', itemId: ITEM, keptItemId: KEPT, publishedBentoId: null },
    });
    assert.deepEqual(target(row({ kind: 'item_rejected', item_id: ITEM, item_status: 'rejected' })), {
      kind: 'push',
      target: { kind: 'item', status: 'rejected', itemId: ITEM, keptItemId: null, publishedBentoId: null },
    });
  });

  it('le bento publié ouvre sa page ; le pourquoi masqué, « Tes pourquoi »', () => {
    assert.deepEqual(target(row({ kind: 'bento_published' })), { kind: 'page', href: '/u/alice' });
    assert.deepEqual(target(row({ kind: 'why_hidden' })), { kind: 'whys', bentoId: BENTO, pseudo: 'alice', slug: null });
    assert.deepEqual(target(row({ kind: 'why_hidden', bento_primary: false, bento_slug: 'ete' })), {
      kind: 'whys',
      bentoId: BENTO,
      pseudo: 'alice',
      slug: 'ete',
    });
  });

  it('sans de quoi y aller, aucune destination', () => {
    assert.equal(target(row({ owner_pseudo: null })), null);
    assert.equal(target(row({ kind: 'comment', bento_id: null })), null);
    assert.equal(target(row({ kind: 'item_validated', item_id: null, item_status: 'validated' })), null);
    assert.equal(target(row({ kind: 'item_rejected', item_id: ITEM, item_status: null })), null);
  });
});

describe('la liste', () => {
  it('une clé par moitié d\'un même sujet', () => {
    const fresh = toNotification(row({ is_new: true }), viewer);
    const old = toNotification(row({ is_new: false }), viewer);
    assert.notEqual(fresh.key, old.key);
  });

  it('« Nouveau » puis « Plus tôt », sans section vide', () => {
    const items = [row({ is_new: true }), row({ is_new: false, group_key: 'follow', kind: 'follow' })].map((r) =>
      toNotification(r, viewer),
    );
    assert.deepEqual(
      notificationSections(items).map((s) => [s.title, s.data.length]),
      [
        ['Nouveau', 1],
        ['Plus tôt', 1],
      ],
    );
    assert.deepEqual(notificationSections(items.slice(1)).map((s) => s.title), ['Plus tôt']);
    assert.deepEqual(notificationSections([]), []);
  });

  it('le lecteur d\'écran lit la phrase, « nouveau » et l\'heure (D20)', () => {
    const now = Date.parse('2026-10-27T12:00:00.000Z');
    assert.equal(
      notificationAccessibilityLabel(toNotification(row({ events: 3 }), viewer), now),
      '3 personnes ont aimé ton bento, nouveau, il y a 2 h',
    );
    assert.equal(
      notificationAccessibilityLabel(toNotification(row({ is_new: false }), viewer), now),
      '1 personne a aimé ton bento, il y a 2 h',
    );
  });

  it('le curseur : la dernière ligne d\'une page pleine, rien après une page courte', () => {
    const full = Array.from({ length: NOTIFICATION_PAGE }, (_, i) =>
      row({ group_key: `like:${i}`, latest_at: new Date(Date.UTC(2026, 9, 27, 10, 0, 60 - i)).toISOString() }),
    );
    assert.deepEqual(notificationCursor(full), { before: full[NOTIFICATION_PAGE - 1]!.latest_at, beforeKey: 'like:29' });
    assert.equal(notificationCursor(full.slice(0, 3)), null);
    assert.equal(notificationCursor([]), null);
  });

  it('la date lue est celle de la ligne la plus récente (D8)', () => {
    assert.equal(seenUntil([row({ latest_at: '2026-10-27T11:00:00.000Z' }), row()]), '2026-10-27T11:00:00.000Z');
    assert.equal(seenUntil([]), null);
  });
});

describe('la pastille et l\'onglet', () => {
  it('rien à zéro, le nombre jusqu\'à 9, puis « 9+ »', () => {
    assert.equal(badgeText(0), null);
    assert.equal(badgeText(-1), null);
    assert.equal(badgeText(Number.NaN), null);
    assert.equal(badgeText(1), '1');
    assert.equal(badgeText(9), '9');
    assert.equal(badgeText(10), '9+');
  });

  it('le libellé de l\'onglet dit le nombre et sa place (D20)', () => {
    assert.equal(notificationsTabLabel(0, 4, 5), 'Notifications, onglet 4 sur 5');
    assert.equal(notificationsTabLabel(1, 4, 5), 'Notifications, 1 nouvelle, onglet 4 sur 5');
    assert.equal(notificationsTabLabel(12, 4, 5), 'Notifications, 12 nouvelles, onglet 4 sur 5');
  });
});
