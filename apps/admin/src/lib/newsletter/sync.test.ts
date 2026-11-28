import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ResendError, createResend, type ResendContact } from './resend';
import { planSync, syncSegment } from './sync';

const contact = (id: string, email: string, unsubscribed = false): ResendContact => ({ id, email, unsubscribed });

describe('plan d’alignement', () => {
  it('crée les absents, efface les partis, rattrape les désinscrits', () => {
    const plan = planSync(
      ['a@x.fr', 'B@x.fr', 'c@x.fr'],
      [contact('1', 'b@x.fr'), contact('2', 'c@x.fr', true), contact('3', 'd@x.fr'), contact('4', 'e@x.fr', true)],
    );
    assert.deepEqual(plan.create, ['a@x.fr']);
    assert.deepEqual(plan.remove.map((c) => c.id), ['3', '4']);
    assert.deepEqual(plan.erase.map((c) => c.id), ['2']);
    assert.equal(plan.recipients, 2);
  });

  it('ne fait rien sur des listes égales', () => {
    const plan = planSync(['a@x.fr'], [contact('1', 'A@x.fr')]);
    assert.deepEqual([plan.create, plan.remove, plan.erase, plan.recipients], [[], [], [], 1]);
  });
});

/** Un faux Resend en mémoire, au niveau de `fetch`. */
function fakeResend(initial: ResendContact[], opts: { existing?: string[]; failCreate?: string[] } = {}) {
  const contacts = new Map(initial.map((c) => [c.id, { ...c }]));
  const calls: string[] = [];
  let next = 100;
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    calls.push(`${method} ${url.pathname}`);
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (method === 'GET' && url.pathname === '/contacts') {
      const all = [...contacts.values()];
      const after = url.searchParams.get('after');
      const start = after ? all.findIndex((c) => c.id === after) + 1 : 0;
      const page = all.slice(start, start + 2);
      return json(200, { object: 'list', has_more: start + 2 < all.length, data: page });
    }
    if (method === 'POST' && url.pathname === '/contacts') {
      const body = JSON.parse(String(init?.body)) as { email: string };
      if (opts.failCreate?.includes(body.email)) return json(500, { message: 'boom' });
      if (opts.existing?.includes(body.email)) return json(422, { message: 'Contact already exists' });
      const id = String(next++);
      contacts.set(id, { id, email: body.email, unsubscribed: false });
      return json(201, { object: 'contact', id });
    }
    if (method === 'POST' && /^\/contacts\/[^/]+\/segments\//.test(url.pathname)) return json(200, { id: 'seg' });
    if (method === 'DELETE' && url.pathname.startsWith('/contacts/')) {
      const id = decodeURIComponent(url.pathname.slice('/contacts/'.length));
      return contacts.delete(id) ? json(200, { deleted: true }) : json(404, { message: 'not found' });
    }
    return json(404, { message: 'route inconnue' });
  }) as typeof fetch;
  return { resend: createResend({ apiKey: 'k', baseUrl: 'https://resend.test', fetchImpl }), contacts, calls };
}

const noSleep = async () => {};

describe('alignement du segment', () => {
  it('lit toutes les pages, aligne et rend le nombre de destinataires', async () => {
    const fake = fakeResend([
      contact('1', 'a@x.fr'),
      contact('2', 'gone@x.fr'),
      contact('3', 'unsub@x.fr', true),
    ]);
    const erased: string[][] = [];
    const result = await syncSegment({
      resend: fake.resend,
      segmentId: 'seg',
      subscribers: ['a@x.fr', 'unsub@x.fr', 'new@x.fr'],
      eraseSubscribers: async (emails) => void erased.push(emails),
      sleep: noSleep,
    });
    assert.deepEqual(result, { recipients: 2, created: 1, removed: 2, erased: 1, failed: 0 });
    assert.deepEqual(erased, [['unsub@x.fr']]);
    assert.deepEqual(
      [...fake.contacts.values()].map((c) => c.email).sort(),
      ['a@x.fr', 'new@x.fr'],
    );
    assert.equal(fake.calls.filter((c) => c === 'GET /contacts').length, 2);
  });

  it('ajoute au segment une adresse que Resend connaît déjà', async () => {
    const fake = fakeResend([], { existing: ['old@x.fr'] });
    const result = await syncSegment({
      resend: fake.resend,
      segmentId: 'seg',
      subscribers: ['old@x.fr'],
      eraseSubscribers: async () => {},
      sleep: noSleep,
    });
    assert.equal(result.created, 1);
    assert.ok(fake.calls.includes('POST /contacts/old%40x.fr/segments/seg'));
  });

  it('compte les échecs sans s’arrêter', async () => {
    const fake = fakeResend([], { failCreate: ['ko@x.fr'] });
    const result = await syncSegment({
      resend: fake.resend,
      segmentId: 'seg',
      subscribers: ['ko@x.fr', 'ok@x.fr'],
      eraseSubscribers: async () => {},
      sleep: noSleep,
    });
    assert.deepEqual([result.created, result.failed], [1, 1]);
  });

  it('remonte une erreur de lecture de la liste', async () => {
    const resend = createResend({
      apiKey: 'k',
      fetchImpl: (async () => new Response('{"message":"invalid key"}', { status: 401 })) as typeof fetch,
    });
    await assert.rejects(
      syncSegment({ resend, segmentId: 'seg', subscribers: [], eraseSubscribers: async () => {}, sleep: noSleep }),
      (e: unknown) => e instanceof ResendError && e.status === 401,
    );
  });
});
