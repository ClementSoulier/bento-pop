import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ALERT_INTERVAL_MS, type AlertableReport } from './digest';
import { createMailer, parseSender, type MailMessage, type Mailer } from './mailer';
import { runModerationDigest, type ModerationStore } from './run-digest';

const report = (id: string): AlertableReport => ({
  id,
  target_kind: 'comment',
  target_pseudo: 'alice',
  reason_code: 'spam',
  target_text: 'Achetez',
  created_at: '2026-10-26T10:00:00Z',
});

function fakeStore(reports: AlertableReport[], lastAlertAt: Date | null) {
  const marked: string[][] = [];
  const store: ModerationStore = {
    unalertedReports: async () => reports,
    lastAlertAt: async () => lastAlertAt,
    markAlerted: async (ids) => {
      marked.push([...ids]);
    },
  };
  return { store, marked };
}

function fakeMailer(fail = false) {
  const sent: MailMessage[] = [];
  const mailer: Mailer = {
    transport: 'mailpit',
    send: async (m) => {
      if (fail) throw new Error('boom');
      sent.push(m);
    },
  };
  return { mailer, sent };
}

const now = new Date('2026-10-26T12:00:00Z');
const base = { recipients: ['equipe@x.test'], adminUrl: 'https://bo.x.test', now };

describe('le passage du battement (D11)', () => {
  it('envoie un mail qui groupe tout, puis marque chaque signalement', async () => {
    const { store, marked } = fakeStore([report('r1'), report('r2')], null);
    const { mailer, sent } = fakeMailer();
    assert.deepEqual(await runModerationDigest({ store, mailer, ...base }), { sent: 2 });
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0]?.to, ['equipe@x.test']);
    assert.deepEqual(marked, [['r1', 'r2']]);
  });

  it('ne fait rien sans signalement', async () => {
    const { store } = fakeStore([], null);
    const { mailer, sent } = fakeMailer();
    assert.deepEqual(await runModerationDigest({ store, mailer, ...base }), { skipped: 'nothing' });
    assert.equal(sent.length, 0);
  });

  it("attend l'heure après le précédent", async () => {
    const { store, marked } = fakeStore(
      [report('r1')],
      new Date(now.getTime() - ALERT_INTERVAL_MS / 2),
    );
    const { mailer, sent } = fakeMailer();
    assert.deepEqual(await runModerationDigest({ store, mailer, ...base }), {
      skipped: 'too-soon',
    });
    assert.equal(sent.length, 0);
    assert.equal(marked.length, 0);
  });

  it('sans transport ni destinataire, ne marque rien : le mail partira à la mise en service', async () => {
    const { store, marked } = fakeStore([report('r1')], null);
    assert.deepEqual(await runModerationDigest({ store, mailer: null, ...base }), {
      skipped: 'no-mailer',
    });
    const { mailer } = fakeMailer();
    assert.deepEqual(await runModerationDigest({ store, mailer, ...base, recipients: [] }), {
      skipped: 'no-recipients',
    });
    assert.equal(marked.length, 0);
  });

  it('un envoi perdu ne marque rien : il repart au battement suivant', async () => {
    const { store, marked } = fakeStore([report('r1')], null);
    const { mailer } = fakeMailer(true);
    await assert.rejects(runModerationDigest({ store, mailer, ...base }), /boom/);
    assert.equal(marked.length, 0);
  });
});

describe('les transports (D12)', () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response('{}', { status: 200 });
  }) as typeof fetch;

  it("lit l'expéditeur, nommé ou non", () => {
    assert.deepEqual(parseSender('Bento Pop <moderation@x.fr>'), {
      name: 'Bento Pop',
      email: 'moderation@x.fr',
    });
    assert.deepEqual(parseSender('moderation@x.fr'), { name: '', email: 'moderation@x.fr' });
    assert.equal(parseSender('pas une adresse'), null);
  });

  it('sans expéditeur ou sans clé, rien', () => {
    assert.equal(createMailer({ RESEND_API_KEY: 'k' }, fakeFetch), null);
    assert.equal(createMailer({ MODERATION_FROM: 'a@x.fr' }, fakeFetch), null);
    assert.equal(
      createMailer({ MODERATION_FROM: 'a@x.fr', MAIL_TRANSPORT: 'mailpit' }, fakeFetch),
      null,
    );
  });

  it('Resend par défaut, la clé en porteur', async () => {
    calls.length = 0;
    const mailer = createMailer(
      { MODERATION_FROM: 'Bento Pop <m@x.fr>', RESEND_API_KEY: 'cle' },
      fakeFetch,
    );
    await mailer?.send({ to: ['e@x.fr'], subject: 's', text: 't', html: '<p>t</p>' });
    assert.equal(calls[0]?.url, 'https://api.resend.com/emails');
    assert.equal((calls[0]?.init.headers as Record<string, string>).Authorization, 'Bearer cle');
    assert.deepEqual(JSON.parse(String(calls[0]?.init.body)), {
      from: 'Bento Pop <m@x.fr>',
      to: ['e@x.fr'],
      subject: 's',
      text: 't',
      html: '<p>t</p>',
    });
  });

  it("Mailpit en local, par son API d'envoi", async () => {
    calls.length = 0;
    const mailer = createMailer(
      {
        MODERATION_FROM: 'Bento Pop <m@x.fr>',
        MAIL_TRANSPORT: 'mailpit',
        MAILPIT_URL: 'http://127.0.0.1:54374/',
      },
      fakeFetch,
    );
    await mailer?.send({ to: ['e@x.fr'], subject: 's', text: 't', html: '<p>t</p>' });
    assert.equal(calls[0]?.url, 'http://127.0.0.1:54374/api/v1/send');
    const body = JSON.parse(String(calls[0]?.init.body));
    assert.deepEqual(body.From, { Email: 'm@x.fr', Name: 'Bento Pop' });
    assert.deepEqual(body.To, [{ Email: 'e@x.fr' }]);
  });
});
