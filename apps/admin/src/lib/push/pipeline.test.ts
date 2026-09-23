import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AnnounceableEdition } from './announce';
import type { PushMessage } from './content';
import {
  type ItemForPush,
  type NewTicket,
  type PushDeps,
  type PushSender,
  type PushStore,
  checkReceipts,
  notifyItemModerated,
  runTick,
} from './pipeline';
import type { PushTokenRow } from './recipients';
import type { PushReceipt, PushTicket } from './tickets';

/**
 * Les deux parcours complets, sur une base et un Expo simulés. La base
 * simulée filtre moins que la vraie requête : c'est la règle de
 * `recipients.ts` qui doit écarter les appareils, et ces tests le prouvent.
 */

// Jeudi 24 septembre 2026, 18 h 05 à Paris.
const maintenant = new Date('2026-09-24T16:05:00Z');
const hier = '2026-09-23T16:05:00Z';

type Ticket = NewTicket & { createdAt: string; checkedAt: string | null; status: string | null };

function fausseBase(seed: {
  items?: ItemForPush[];
  tokens?: PushTokenRow[];
  editions?: AnnounceableEdition[];
  tickets?: Ticket[];
}) {
  const state = {
    items: seed.items ?? [],
    tokens: seed.tokens ?? [],
    editions: seed.editions ?? [],
    tickets: seed.tickets ?? [],
    sent: [] as { kind: string; at: string }[],
    errors: [] as string[],
  };
  const store: PushStore = {
    item: async (id) => state.items.find((i) => i.id === id) ?? null,
    tokensOfUser: async (userId) => state.tokens.filter((t) => t.user_id === userId),
    editorialTokens: async () => state.tokens,
    saveTickets: async (rows) => {
      for (const r of rows) {
        state.tickets.push({ ...r, createdAt: maintenant.toISOString(), checkedAt: null, status: null });
      }
    },
    revokeTokens: async (ids, at) => {
      for (const t of state.tokens) if (ids.includes(t.id)) t.revoked_at = at.toISOString();
    },
    dueEditions: async () => state.editions.filter((e) => e.announced_at === null).map((e) => ({ ...e })),
    claimEdition: async (id, at) => {
      const e = state.editions.find((x) => x.id === id);
      if (!e || e.announced_at !== null) return false;
      e.announced_at = at.toISOString();
      return true;
    },
    releaseEdition: async (id) => {
      const e = state.editions.find((x) => x.id === id);
      if (e) e.announced_at = null;
    },
    expireTickets: async (before, at) => {
      let n = 0;
      for (const t of state.tickets) {
        if (t.checkedAt === null && Date.parse(t.createdAt) < before.getTime()) {
          t.checkedAt = at.toISOString();
          t.status = 'expired';
          n += 1;
        }
      }
      return n;
    },
    ticketsToCheck: async (before, after) =>
      state.tickets
        .filter(
          (t) =>
            t.checkedAt === null &&
            Date.parse(t.createdAt) <= before.getTime() &&
            Date.parse(t.createdAt) > after.getTime(),
        )
        .map((t) => ({ ticketId: t.ticketId, tokenId: t.tokenId })),
    saveReceipts: async (checked, at) => {
      for (const c of checked) {
        const t = state.tickets.find((x) => x.ticketId === c.ticketId);
        if (t) {
          t.checkedAt = at.toISOString();
          t.status = c.status;
        }
      }
    },
    noteSent: async (kind, at) => {
      state.sent.push({ kind, at: at.toISOString() });
    },
    noteError: async (message) => {
      state.errors.push(message);
    },
  };
  return { state, store };
}

function fauxExpo(options: {
  ticket?: (m: PushMessage) => PushTicket;
  receipts?: Record<string, PushReceipt>;
  receiptsFail?: boolean;
} = {}) {
  const calls = { sent: [] as PushMessage[][], receipts: [] as string[][] };
  let n = 0;
  const sender: PushSender = {
    send: async (messages) => {
      calls.sent.push(messages);
      return messages.map((m) => options.ticket?.(m) ?? { status: 'ok', id: `ticket-${++n}` });
    },
    receipts: async (ids) => {
      calls.receipts.push(ids);
      if (options.receiptsFail) throw new Error('fetch failed');
      return options.receipts ?? {};
    },
  };
  return { calls, sender };
}

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

const item = (over: Partial<ItemForPush> = {}): ItemForPush => ({
  id: 'item-1',
  title: 'Interstellar',
  status: 'validated',
  submittedBy: 'auteur',
  rejectedReason: null,
  keptItemId: null,
  keptTitle: null,
  ...over,
});

const deps = (store: PushStore, sender: PushSender): PushDeps => ({ store, sender, now: () => maintenant });

describe('un item validé prévient son auteur', () => {
  it('un message par appareil actif, tickets rangés avec l’item', async () => {
    const { state, store } = fausseBase({
      items: [item()],
      tokens: [
        appareil('iphone'),
        appareil('ipad'),
        appareil('coupe', { transactional: false }),
        appareil('perdu', { revoked_at: hier }),
        appareil('ailleurs', { user_id: 'quelqu-un' }),
      ],
    });
    const { calls, sender } = fauxExpo();
    const outcome = await notifyItemModerated({ itemId: 'item-1', status: 'validated' }, deps(store, sender));

    assert.deepEqual(outcome, { state: 'sent', recipients: 2, accepted: 2, revoked: 0, errors: [] });
    assert.deepEqual(calls.sent[0]?.map((m) => m.to), [
      'ExponentPushToken[iphone]',
      'ExponentPushToken[ipad]',
    ]);
    assert.deepEqual(calls.sent[0]?.[0], {
      to: 'ExponentPushToken[iphone]',
      title: '« Interstellar » est validé',
      body: 'Ta case est en ligne.',
      data: { type: 'item_moderated', status: 'validated', itemId: 'item-1' },
      channelId: 'items',
      sound: 'default',
      priority: 'default',
    });
    assert.deepEqual(
      state.tickets.map((t) => [t.tokenId, t.kind, t.itemId]),
      [
        ['iphone', 'item_moderated', 'item-1'],
        ['ipad', 'item_moderated', 'item-1'],
      ],
    );
    assert.deepEqual(state.sent, [{ kind: 'item_moderated', at: maintenant.toISOString() }]);
  });

  it('une fusion nomme l’item conservé et le désigne (D12)', async () => {
    const { store } = fausseBase({
      items: [item({ status: 'merged', title: 'interstelar', keptItemId: 'item-canon', keptTitle: 'Interstellar' })],
      tokens: [appareil('iphone')],
    });
    const { calls, sender } = fauxExpo();
    await notifyItemModerated({ itemId: 'item-1', status: 'merged' }, deps(store, sender));
    const message = calls.sent[0]?.[0];
    assert.equal(message?.title, '« Interstellar » est validé');
    assert.deepEqual(message?.data, {
      type: 'item_moderated',
      status: 'merged',
      itemId: 'item-1',
      keptItemId: 'item-canon',
    });
  });

  it('un refus porte sa raison', async () => {
    const { store } = fausseBase({
      items: [item({ status: 'rejected', rejectedReason: 'Déjà au catalogue.' })],
      tokens: [appareil('iphone')],
    });
    const { calls, sender } = fauxExpo();
    await notifyItemModerated({ itemId: 'item-1', status: 'rejected' }, deps(store, sender));
    assert.equal(calls.sent[0]?.[0]?.body, 'Déjà au catalogue.');
  });

  it('validé puis refusé aussitôt : l’événement périmé n’envoie rien', async () => {
    const { store } = fausseBase({ items: [item({ status: 'rejected' })], tokens: [appareil('iphone')] });
    const { calls, sender } = fauxExpo();
    const outcome = await notifyItemModerated({ itemId: 'item-1', status: 'validated' }, deps(store, sender));
    assert.deepEqual(outcome, { state: 'skipped', reason: 'superseded' });
    assert.equal(calls.sent.length, 0);
  });

  it('un item inconnu, sans auteur, ou sans appareil : rien ne part', async () => {
    const { store } = fausseBase({
      items: [item({ id: 'sans-auteur', submittedBy: null }), item({ id: 'sans-appareil', submittedBy: 'x' })],
      tokens: [appareil('iphone')],
    });
    const { calls, sender } = fauxExpo();
    const d = deps(store, sender);
    assert.deepEqual(await notifyItemModerated({ itemId: 'inconnu', status: 'validated' }, d), {
      state: 'skipped',
      reason: 'unknown-item',
    });
    assert.deepEqual(await notifyItemModerated({ itemId: 'sans-auteur', status: 'validated' }, d), {
      state: 'skipped',
      reason: 'no-author',
    });
    assert.deepEqual(await notifyItemModerated({ itemId: 'sans-appareil', status: 'validated' }, d), {
      state: 'skipped',
      reason: 'no-recipient',
    });
    assert.equal(calls.sent.length, 0);
  });

  it('un ticket DeviceNotRegistered révoque l’appareil tout de suite', async () => {
    const { state, store } = fausseBase({ items: [item()], tokens: [appareil('iphone'), appareil('vieux')] });
    const { sender } = fauxExpo({
      ticket: (m) =>
        m.to.includes('vieux')
          ? { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } }
          : { status: 'ok', id: 'ticket-iphone' },
    });
    const outcome = await notifyItemModerated({ itemId: 'item-1', status: 'validated' }, deps(store, sender));
    assert.equal(outcome.state === 'sent' && outcome.revoked, 1);
    assert.equal(state.tokens.find((t) => t.id === 'vieux')?.revoked_at, maintenant.toISOString());
    assert.equal(state.tickets.length, 1);
    assert.deepEqual(state.errors, []);
  });

  it('Expo injoignable : l’erreur se note, rien n’est rangé', async () => {
    const { state, store } = fausseBase({ items: [item()], tokens: [appareil('iphone')] });
    const sender: PushSender = {
      send: async () => {
        throw new Error('UNAUTHORIZED: The request is missing a valid access token');
      },
      receipts: async () => ({}),
    };
    await notifyItemModerated({ itemId: 'item-1', status: 'validated' }, deps(store, sender));
    assert.deepEqual(state.tickets, []);
    assert.deepEqual(state.sent, []);
    assert.deepEqual(state.errors, [
      'RequestFailed : UNAUTHORIZED: The request is missing a valid access token',
    ]);
  });
});

describe('le battement annonce l’édition sortie', () => {
  const edition = (over: Partial<AnnounceableEdition> = {}): AnnounceableEdition => ({
    id: 7,
    slug: 'films-de-l-ete',
    title: 'Les films de l’été',
    released_at: '2026-09-24T16:00:00Z',
    announced_at: null,
    ...over,
  });

  it('à ceux qui l’ont accepté, avec sa durée de vie, une seule fois', async () => {
    const { state, store } = fausseBase({
      editions: [edition()],
      tokens: [appareil('accepte', { editorial: true, user_id: 'x' }), appareil('refuse', { user_id: 'y' })],
    });
    const { calls, sender } = fauxExpo();
    const d = deps(store, sender);

    const premier = await runTick(d);
    assert.deepEqual(premier.announce, {
      edition: { id: 7, recipients: 1, accepted: 1 },
      skipped: [],
      released: false,
    });
    assert.deepEqual(calls.sent[0], [
      {
        to: 'ExponentPushToken[accepte]',
        title: '« Les films de l’été » est sortie',
        body: 'Compose ton bento de la semaine.',
        data: { type: 'edition_released', editionId: 7, slug: 'films-de-l-ete' },
        channelId: 'editions',
        sound: 'default',
        priority: 'default',
        ttl: 23 * 3600 + 55 * 60,
      },
    ]);
    assert.equal(state.editions[0]?.announced_at, maintenant.toISOString());
    assert.deepEqual(state.tickets.map((t) => t.editionId), [7]);

    await runTick(d);
    assert.equal(calls.sent.length, 1, 'le battement suivant ne la réannonce pas');
  });

  it('Expo injoignable : l’édition est rendue, et le battement suivant l’annonce', async () => {
    const { state, store } = fausseBase({
      editions: [edition()],
      tokens: [appareil('accepte', { editorial: true })],
    });
    let panne = true;
    const sender: PushSender = {
      send: async (messages) =>
        messages.map(() =>
          panne
            ? { status: 'error' as const, message: 'fetch failed', details: { error: 'RequestFailed' } }
            : { status: 'ok' as const, id: 'ticket-apres-panne' },
        ),
      receipts: async () => ({}),
    };
    const d = deps(store, sender);

    const pendant = await runTick(d);
    assert.equal('released' in pendant.announce && pendant.announce.released, true);
    assert.equal(state.editions[0]?.announced_at, null);
    assert.deepEqual(state.errors, ['RequestFailed : fetch failed']);

    panne = false;
    const apres = await runTick(d);
    assert.equal('edition' in apres.announce && apres.announce.edition?.accepted, 1);
    assert.equal(state.editions[0]?.announced_at, maintenant.toISOString());
  });

  it('personne n’a accepté : l’édition est marquée, rien ne part', async () => {
    const { state, store } = fausseBase({ editions: [edition()], tokens: [appareil('refuse')] });
    const { calls, sender } = fauxExpo();
    await runTick(deps(store, sender));
    assert.equal(calls.sent.length, 0);
    assert.equal(state.editions[0]?.announced_at, maintenant.toISOString());
  });

  it('deux éditions dues : la plus récente seule s’annonce', async () => {
    const { state, store } = fausseBase({
      editions: [edition({ id: 6, released_at: '2026-09-24T08:00:00Z' }), edition()],
      tokens: [appareil('accepte', { editorial: true })],
    });
    const { calls, sender } = fauxExpo();
    const outcome = await runTick(deps(store, sender));
    assert.deepEqual('skipped' in outcome.announce && outcome.announce.skipped, [6]);
    assert.equal(calls.sent.length, 1);
    assert.equal(calls.sent[0]?.[0]?.data.editionId, 7);
    assert.ok(state.editions.every((e) => e.announced_at !== null));
  });

  it('une édition qu’un autre battement a réservée entre-temps n’est pas envoyée', async () => {
    const { store } = fausseBase({ editions: [edition()], tokens: [appareil('accepte', { editorial: true })] });
    // La lecture voit l'édition libre, la réservation la trouve prise.
    const lue = await store.dueEditions(maintenant);
    await store.claimEdition(7, maintenant);
    const concurrent: PushStore = { ...store, dueEditions: async () => lue };
    const { calls, sender } = fauxExpo();
    await runTick(deps(concurrent, sender));
    assert.equal(calls.sent.length, 0);
  });
});

describe('le battement relit les accusés de réception', () => {
  const ticket = (ticketId: string, tokenId: string, minutes: number): Ticket => ({
    ticketId,
    tokenId,
    kind: 'item_moderated',
    itemId: 'item-1',
    createdAt: new Date(maintenant.getTime() - minutes * 60_000).toISOString(),
    checkedAt: null,
    status: null,
  });

  it('entre 15 minutes et 24 heures ; DeviceNotRegistered révoque ; au-delà, expiré', async () => {
    const { state, store } = fausseBase({
      tokens: [appareil('a'), appareil('b'), appareil('c')],
      tickets: [
        ticket('t-trop-tot', 'a', 5),
        ticket('t-ok', 'a', 20),
        ticket('t-perdu', 'b', 60),
        ticket('t-cles', 'c', 90),
        ticket('t-trop-vieux', 'c', 25 * 60),
      ],
    });
    const { calls, sender } = fauxExpo({
      receipts: {
        't-ok': { status: 'ok' },
        't-perdu': { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } },
        't-cles': { status: 'error', message: 'bad key', details: { error: 'InvalidCredentials' } },
      },
    });

    const outcome = await checkReceipts(deps(store, sender), maintenant);
    assert.deepEqual(outcome, { checked: 3, revoked: 1, expired: 1, failed: false });
    assert.deepEqual(calls.receipts, [['t-ok', 't-perdu', 't-cles']]);

    const statut = (id: string) => state.tickets.find((t) => t.ticketId === id)?.status;
    assert.equal(statut('t-trop-tot'), null);
    assert.equal(statut('t-ok'), 'ok');
    assert.equal(statut('t-perdu'), 'DeviceNotRegistered');
    assert.equal(statut('t-cles'), 'InvalidCredentials');
    assert.equal(statut('t-trop-vieux'), 'expired');
    assert.equal(state.tokens.find((t) => t.id === 'b')?.revoked_at, maintenant.toISOString());
    assert.deepEqual(state.errors, ['InvalidCredentials : bad key']);
  });

  it('Expo injoignable : rien n’est marqué, le battement suivant réessaie', async () => {
    const { state, store } = fausseBase({ tickets: [ticket('t-ok', 'a', 20)] });
    const { sender } = fauxExpo({ receiptsFail: true });
    const outcome = await checkReceipts(deps(store, sender), maintenant);
    assert.equal(outcome.failed, true);
    assert.equal(state.tickets[0]?.checkedAt, null);
    assert.deepEqual(state.errors, ['RequestFailed : fetch failed']);
  });

  it('une annonce en panne n’empêche pas la relecture', async () => {
    const { state, store } = fausseBase({ tickets: [ticket('t-ok', 'a', 20)] });
    const cassee: PushStore = {
      ...store,
      dueEditions: async () => {
        throw new Error('connexion perdue');
      },
    };
    const { sender } = fauxExpo({ receipts: { 't-ok': { status: 'ok' } } });
    const outcome = await runTick(deps(cassee, sender));
    assert.deepEqual(outcome.announce, { error: 'TickFailed : connexion perdue' });
    assert.equal('checked' in outcome.receipts && outcome.receipts.checked, 1);
    assert.equal(state.tickets[0]?.status, 'ok');
  });
});
