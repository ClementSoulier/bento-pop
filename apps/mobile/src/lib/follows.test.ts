import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatFollowCount } from '@bento-pop/supabase-mobile/bento';
import type { FollowListRow } from '@/supabase/types';
import {
  FOLLOW_PAGE,
  expectedStatus,
  followButton,
  followCursor,
  followErrorKey,
  followErrorMessage,
  followSegment,
  profileDateLine,
  toFollowEntry,
  toFollowSummary,
  withFollowStatus,
  type FollowSummary,
} from './follows';

const NBSP = ' ';

const summary = (over: Partial<FollowSummary> = {}): FollowSummary => ({
  followers: 0,
  following: 0,
  requests: null,
  myStatus: null,
  approval: false,
  ...over,
});

describe('les nombres (D14)', () => {
  it("s'écrivent comme les visites : zéro et un au singulier, une espace insécable", () => {
    assert.equal(formatFollowCount(0, 'abonné'), `0${NBSP}abonné`);
    assert.equal(formatFollowCount(1, 'abonné'), `1${NBSP}abonné`);
    assert.equal(formatFollowCount(4, 'abonné'), `4${NBSP}abonnés`);
    assert.equal(formatFollowCount(2, 'demande'), `2${NBSP}demandes`);
    assert.match(formatFollowCount(1234, 'abonnement'), /^1\s234 abonnements$/);
  });
});

describe('ce que la ligne de date ajoute (D2, D9)', () => {
  it("rien sans abonné ni abonnement : la ligne reste celle d'avant", () => {
    assert.equal(followSegment(null), null);
    assert.equal(followSegment({ followers: 0, following: 0, requests: null }), null);
  });

  it("le nombre d'abonnés dès le premier, et lui seul", () => {
    assert.equal(followSegment({ followers: 1, following: 3 }), `1${NBSP}abonné`);
    assert.equal(followSegment({ followers: 4, following: 0 }), `4${NBSP}abonnés`);
  });

  it("à défaut d'abonné, celui des abonnements", () => {
    assert.equal(followSegment({ followers: 0, following: 3 }), `3${NBSP}abonnements`);
  });

  it('les demandes, que la base ne rend qu’à leur titulaire', () => {
    assert.equal(
      followSegment({ followers: 4, following: 0, requests: 2 }),
      `4${NBSP}abonnés · 2${NBSP}demandes`,
    );
    assert.equal(followSegment({ followers: 0, following: 0, requests: 1 }), `1${NBSP}demande`);
    assert.equal(followSegment({ followers: 0, following: 0, requests: 0 }), null);
  });
});

describe('la ligne sous le pseudo (D2, D20)', () => {
  const base = {
    displayName: null,
    editionTitle: null,
    publishedAt: '2026-09-12T10:00:00Z',
    visits: undefined,
    segment: null,
  };

  it("sans nombre, la phrase d'avant, mot pour mot", () => {
    const line = profileDateLine(base);
    assert.equal(line.text, 'bento publié le 12 septembre 2026');
    assert.equal(line.accessibilityLabel, line.text);
  });

  it('avec les visites du chantier 8, comme avant', () => {
    assert.equal(profileDateLine({ ...base, visits: 14 }).text, `bento publié le 12 septembre 2026 · 14${NBSP}visites`);
  });

  it('avec les nombres, la date raccourcie, puis eux', () => {
    const line = profileDateLine({ ...base, visits: 14, segment: `4${NBSP}abonnés` });
    assert.match(line.text, /^publié le 12 sept\.? 2026 · 14 visites · 4 abonnés$/);
    assert.equal(line.text, `${line.head} · ${line.segment}`);
    assert.equal(line.segment, `4${NBSP}abonnés`);
  });

  it('sans nombre, rien à souligner', () => {
    const line = profileDateLine(base);
    assert.equal(line.head, line.text);
    assert.equal(line.segment, null);
  });

  it('le lecteur d’écran la lit en entier, la date longue', () => {
    const line = profileDateLine({ ...base, displayName: 'Florian', visits: 14, segment: `4${NBSP}abonnés` });
    assert.equal(line.accessibilityLabel, `Florian, bento publié le 12 septembre 2026, 14${NBSP}visites, 4${NBSP}abonnés`);
  });

  it("une édition garde son titre devant la date", () => {
    const line = profileDateLine({ ...base, editionTitle: 'Édition 3', segment: `1${NBSP}abonné` });
    assert.match(line.text, /^Édition 3, publié le 12 sept\.? 2026 · 1 abonné$/);
  });
});

describe('le bouton de la barre du bas (D5, D20)', () => {
  it('« Suivre », d’un tap', () => {
    const b = followButton(null, 'noxito');
    assert.equal(b.label, 'Suivre');
    assert.equal(b.action, 'follow');
    assert.equal(b.accessibilityLabel, 'Suivre @noxito');
  });

  it('« Abonné » ouvre la feuille d’actions', () => {
    const b = followButton('accepted', 'noxito');
    assert.deepEqual([b.label, b.action, b.accessibilityLabel], ['Abonné', 'menu', 'Abonné à @noxito']);
  });

  it('« Demandé » aussi', () => {
    const b = followButton('pending', 'noxito');
    assert.deepEqual([b.label, b.action, b.accessibilityLabel], ['Demandé', 'menu', 'Demande envoyée à @noxito']);
  });
});

describe('ce qu’un geste change avant la réponse (D13)', () => {
  it('suivre un compte ouvert ajoute un abonné', () => {
    const s = summary({ followers: 3 });
    assert.equal(expectedStatus(s), 'accepted');
    assert.deepEqual(withFollowStatus(s, 'accepted'), summary({ followers: 4, myStatus: 'accepted' }));
  });

  it('demander ne compte pas', () => {
    const s = summary({ followers: 3, approval: true });
    assert.equal(expectedStatus(s), 'pending');
    assert.equal(withFollowStatus(s, 'pending').followers, 3);
  });

  it('ne plus suivre en retire un, jamais sous zéro', () => {
    assert.equal(withFollowStatus(summary({ followers: 4, myStatus: 'accepted' }), null).followers, 3);
    assert.equal(withFollowStatus(summary({ followers: 0, myStatus: 'accepted' }), null).followers, 0);
    assert.equal(withFollowStatus(summary({ followers: 4, myStatus: 'pending' }), null).followers, 4);
  });

  it('se lit depuis la ligne de follow_summary', () => {
    assert.deepEqual(
      toFollowSummary({ followers: 4, following: 1, requests: null, my_status: 'pending', approval: true }),
      summary({ followers: 4, following: 1, myStatus: 'pending', approval: true }),
    );
  });
});

describe('les listes (D8)', () => {
  const rowAt = (i: number): FollowListRow => ({
    user_id: `u${i}`,
    pseudo: `p${i}`,
    display_name: null,
    avatar: null,
    kind: i === 0 ? 'editorial' : 'member',
    status: 'accepted',
    since: `2026-10-${String(27 - (i % 20)).padStart(2, '0')}T10:00:00Z`,
  });

  it('une ligne, le profil éditorial reconnu', () => {
    const e = toFollowEntry(rowAt(0));
    assert.equal(e.userId, 'u0');
    assert.equal(e.isEditorial, true);
    assert.equal(toFollowEntry(rowAt(1)).isEditorial, false);
  });

  it('une page pleine appelle la suivante, après sa dernière ligne', () => {
    const rows = Array.from({ length: FOLLOW_PAGE }, (_, i) => rowAt(i));
    const last = rows[rows.length - 1];
    assert.deepEqual(followCursor(rows), { before: last?.since, beforeId: last?.user_id });
  });

  it("une page incomplète est la dernière", () => {
    assert.equal(followCursor([rowAt(0), rowAt(1)]), null);
    assert.equal(followCursor([]), null);
  });
});

describe('les erreurs de la base', () => {
  it('se disent en phrases', () => {
    assert.equal(followErrorKey(new Error('follow_blocked')), 'follow_blocked');
    assert.equal(followErrorMessage(new Error('follow_blocked')), 'Tu ne peux pas suivre ce compte.');
    assert.equal(
      followErrorMessage(new Error('follow_needs_profile')),
      "Compose d'abord ton bento pour suivre des comptes.",
    );
    assert.equal(followErrorMessage(new Error('follow_too_fast')), "Doucement : attends un peu avant de suivre d'autres comptes.");
  });

  it('le réseau, et le reste', () => {
    assert.equal(followErrorKey(new Error('Network request failed')), 'network');
    assert.equal(followErrorMessage(new Error('Network request failed')), 'Pas de réseau. Réessaie dans un instant.');
    assert.equal(followErrorMessage(new Error('boom')), 'Une erreur est survenue. Réessaie.');
    assert.equal(followErrorKey(null), null);
  });
});
