import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { removalMessage } from './discord';
import { newsletterContactsFromEnv } from './resend';
import { planWebhookEvent, signSvix, verifySvix } from './webhook';

const SECRET = `whsec_${Buffer.from('secret-de-test-du-webhook').toString('base64')}`;
const NOW = 1_795_900_000;
const BODY = '{"type":"email.sent","data":{}}';

describe('signature des webhooks', () => {
  const signature = signSvix(SECRET, 'msg_1', NOW, BODY);

  it('accepte une signature juste', () => {
    assert.ok(verifySvix(SECRET, { id: 'msg_1', timestamp: String(NOW), signature }, BODY, NOW));
  });

  it('accepte la bonne parmi plusieurs, pendant une rotation de secret', () => {
    const several = `v1,${Buffer.from('autre').toString('base64')} ${signature}`;
    assert.ok(verifySvix(SECRET, { id: 'msg_1', timestamp: String(NOW), signature: several }, BODY, NOW));
  });

  it('refuse un corps, un identifiant ou un secret différents', () => {
    const h = { id: 'msg_1', timestamp: String(NOW), signature };
    assert.equal(verifySvix(SECRET, h, BODY.replace('sent', 'bounced'), NOW), false);
    assert.equal(verifySvix(SECRET, { ...h, id: 'msg_2' }, BODY, NOW), false);
    assert.equal(verifySvix(`whsec_${Buffer.from('autre').toString('base64')}`, h, BODY, NOW), false);
  });

  it('refuse un horodatage de plus de 5 minutes, et des en-têtes absents', () => {
    const h = { id: 'msg_1', timestamp: String(NOW), signature };
    assert.equal(verifySvix(SECRET, h, BODY, NOW + 301), false);
    assert.equal(verifySvix(SECRET, { ...h, signature: null }, BODY, NOW), false);
    assert.equal(verifySvix(SECRET, { ...h, signature: 'v2,abc' }, BODY, NOW), false);
  });
});

const DOMAIN = 'news.bento-pop.com';
const mail = (type: string, extra: Record<string, unknown> = {}) => ({
  type,
  data: { from: 'Bento Pop <newsletter@news.bento-pop.com>', to: ['Lea@Example.fr'], broadcast_id: 'b_1', ...extra },
});

describe('ce que fait chaque événement', () => {
  it('efface un contact désinscrit chez Resend', () => {
    assert.deepEqual(
      planWebhookEvent({ type: 'contact.updated', data: { email: 'Lea@Example.fr', unsubscribed: true } }, DOMAIN),
      { kind: 'erase', email: 'lea@example.fr', reason: 'unsubscribe', broadcastId: null },
    );
    assert.deepEqual(
      planWebhookEvent({ type: 'contact.updated', data: { email: 'lea@example.fr', unsubscribed: false } }, DOMAIN),
      { kind: 'ignore' },
    );
  });

  it('compte un mail parti', () => {
    assert.deepEqual(planWebhookEvent(mail('email.sent'), DOMAIN), { kind: 'count', broadcastId: 'b_1' });
  });

  it('efface sur un rebond définitif ou une plainte, pas sur un rebond passager', () => {
    assert.deepEqual(planWebhookEvent(mail('email.bounced', { bounce: { type: 'Permanent' } }), DOMAIN), {
      kind: 'erase',
      email: 'lea@example.fr',
      reason: 'bounce',
      broadcastId: 'b_1',
    });
    assert.deepEqual(planWebhookEvent(mail('email.bounced', { bounce: { type: 'Temporary' } }), DOMAIN), {
      kind: 'ignore',
    });
    assert.equal(planWebhookEvent(mail('email.complained'), DOMAIN).kind, 'erase');
  });

  it('ignore les mails des codes de connexion et de la modération', () => {
    for (const from of ['Bento Pop <codes@auth.bento-pop.com>', 'moderation@moderation.bento-pop.com']) {
      assert.deepEqual(planWebhookEvent(mail('email.complained', { from }), DOMAIN), { kind: 'ignore' });
    }
  });

  it('ignore le reste et le malformé', () => {
    assert.deepEqual(planWebhookEvent(mail('email.opened'), DOMAIN), { kind: 'ignore' });
    assert.deepEqual(planWebhookEvent({ type: 'contact.created', data: {} }, DOMAIN), { kind: 'ignore' });
    assert.deepEqual(planWebhookEvent(null, DOMAIN), { kind: 'ignore' });
    assert.deepEqual(planWebhookEvent({ type: 'email.bounced' }, DOMAIN), { kind: 'ignore' });
  });
});

describe('messages Discord des retraits', () => {
  it('donne le motif et le nombre, jamais l’adresse', () => {
    assert.equal(removalMessage('bounce', 141), '📭 Une adresse retirée de la newsletter : rebond (141 inscrits)');
    assert.equal(
      removalMessage('complaint', null),
      '🚫 Une adresse retirée de la newsletter : signalée comme indésirable',
    );
  });
});

describe('contacts chez Resend', () => {
  const env = { RESEND_NEWSLETTER_API_KEY: 'k', RESEND_NEWSLETTER_SEGMENT_ID: 'seg', RESEND_API_URL: 'https://r.test/' };

  function recorder(statuses: number[]) {
    const calls: string[] = [];
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      calls.push(`${init?.method} ${String(input)}${init?.body ? ` ${String(init.body)}` : ''}`);
      return new Response('{}', { status: statuses.shift() ?? 200 });
    }) as typeof fetch;
    return { calls, fetchImpl };
  }

  it('ne fait rien sans ses variables', () => {
    assert.equal(newsletterContactsFromEnv({ RESEND_NEWSLETTER_API_KEY: 'k' }), null);
  });

  it('crée le contact dans le segment', async () => {
    const r = recorder([201]);
    await newsletterContactsFromEnv(env, r.fetchImpl)!.add('lea@example.fr');
    assert.deepEqual(r.calls, [
      'POST https://r.test/contacts {"email":"lea@example.fr","unsubscribed":false,"segments":[{"id":"seg"}]}',
    ]);
  });

  it('ajoute au segment un contact déjà connu', async () => {
    const r = recorder([422, 200]);
    await newsletterContactsFromEnv(env, r.fetchImpl)!.add('lea@example.fr');
    assert.equal(r.calls[1], 'POST https://r.test/contacts/lea%40example.fr/segments/seg');
  });

  it('efface, et tient un contact inconnu pour déjà effacé', async () => {
    const r = recorder([404]);
    await newsletterContactsFromEnv(env, r.fetchImpl)!.remove('lea@example.fr');
    assert.deepEqual(r.calls, ['DELETE https://r.test/contacts/lea%40example.fr']);
    const failing = recorder([500]);
    await assert.rejects(newsletterContactsFromEnv(env, failing.fetchImpl)!.remove('lea@example.fr'));
  });
});
