import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ALERT_INTERVAL_MS,
  composeBanNotice,
  composeDigest,
  excerpt,
  parseRecipients,
  reasonLabel,
  shouldSendDigest,
  type AlertableReport,
} from './digest';

const report = (over: Partial<AlertableReport> = {}): AlertableReport => ({
  id: 'r1',
  target_kind: 'comment',
  target_pseudo: 'alice',
  reason_code: 'harassment',
  target_text: 'Un commentaire',
  created_at: '2026-10-26T10:00:00Z',
  ...over,
});

const now = new Date('2026-10-26T12:00:00Z');

describe("quand prévenir l'équipe (D11)", () => {
  it('au premier signalement, sans mail avant', () => {
    assert.equal(shouldSendDigest({ unalerted: [report()], lastAlertAt: null, now }), true);
  });

  it('jamais sans signalement à dire', () => {
    assert.equal(shouldSendDigest({ unalerted: [], lastAlertAt: null, now }), false);
  });

  it("pas deux fois dans l'heure", () => {
    const recent = new Date(now.getTime() - ALERT_INTERVAL_MS + 60_000);
    assert.equal(shouldSendDigest({ unalerted: [report()], lastAlertAt: recent, now }), false);
  });

  it('de nouveau une heure après le précédent', () => {
    const anHourAgo = new Date(now.getTime() - ALERT_INTERVAL_MS);
    assert.equal(shouldSendDigest({ unalerted: [report()], lastAlertAt: anHourAgo, now }), true);
  });

  it('au pire 24 mails par jour, sous les 100 de Resend', () => {
    assert.ok((24 * 60 * 60 * 1000) / ALERT_INTERVAL_MS <= 24);
  });
});

describe("le mail à l'équipe (§5.8)", () => {
  it('dit le nombre, chaque cible et son motif, puis le lien', () => {
    const mail = composeDigest(
      [
        report(),
        report({
          id: 'r2',
          target_kind: 'account',
          target_pseudo: 'bob',
          reason_code: 'spam',
          target_text: null,
        }),
      ],
      { adminUrl: 'https://bo.example.test/' },
    );
    assert.equal(mail.subject, 'Bento Pop · 2 signalements à modérer');
    assert.match(
      mail.text,
      /• Commentaire de @alice · Harcèlement ou insultes · « Un commentaire »/,
    );
    assert.match(mail.text, /• Compte @bob · Spam ou arnaque$/m);
    assert.match(mail.text, /Ouvrir la modération : https:\/\/bo\.example\.test\/reports/);
  });

  it('au singulier pour un seul', () => {
    assert.equal(
      composeDigest([report()], { adminUrl: 'https://bo.example.test' }).subject,
      'Bento Pop · 1 signalement à modérer',
    );
  });

  it('échappe le texte signalé dans la version HTML', () => {
    const mail = composeDigest([report({ target_text: '<b>gras</b> & "guillemets"' })], {
      adminUrl: 'https://x.test',
    });
    assert.ok(mail.html.includes('&lt;b&gt;gras&lt;/b&gt; &amp; &quot;guillemets&quot;'));
    assert.ok(!mail.html.includes('<b>gras</b>'));
  });

  it('cite 80 caractères au plus, coupés au mot', () => {
    const long = 'mot '.repeat(40);
    const cut = excerpt(long);
    assert.ok([...cut].length <= 81, cut);
    assert.ok(cut.endsWith('…'));
    assert.equal(excerpt('court'), 'court');
  });

  it("nomme les motifs comme l'app", () => {
    assert.equal(reasonLabel('hate'), 'Haine ou discrimination');
    assert.equal(reasonLabel(null), 'Sans motif');
  });
});

describe("le motif d'un bannissement (D13)", () => {
  it('dit ce qui est fait, pourquoi, sur quelle base, et comment contester', () => {
    const mail = composeBanNotice({ pseudo: 'alice', reason: 'Harcèlement ou insultes' });
    assert.equal(mail.subject, 'Ton compte Mon Bento Pop a été supprimé');
    assert.match(mail.text, /Motif : Harcèlement ou insultes\./);
    assert.match(mail.text, /règles du jeu/);
    assert.match(mail.text, /contact@bento-pop\.com/);
  });
});

describe("les adresses de l'équipe", () => {
  it("se lisent d'une liste, les fausses écartées", () => {
    assert.deepEqual(parseRecipients(' a@x.fr, b@y.fr ;pas-une-adresse '), ['a@x.fr', 'b@y.fr']);
    assert.deepEqual(parseRecipients(undefined), []);
  });
});
