import assert from 'node:assert/strict';
import { after, afterEach, before, describe, it } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { STUB_CLIENT_OPTIONS, startPostgrestStub, type PostgrestStub } from '../test/postgrest-stub';
import {
  fetchNotificationBadge,
  fetchNotifications,
  markNotificationsSeen,
  notificationBadgeKey,
  notificationListKey,
  type NotificationClient,
} from './notification-actions';
import { NOTIFICATION_PAGE } from './notifications';
import type { Database } from '@/supabase/types';

/**
 * Les appels du chantier 24, avec un vrai `supabase-js` contre le bouchon
 * PostgREST : le nom de chaque fonction, ses arguments, et ce que l'app garde
 * de la réponse. Les règles elles-mêmes se contrôlent contre un Supabase
 * local, `scripts/check-notifications.mjs`.
 */

let stub: PostgrestStub;
let client: NotificationClient;

before(async () => {
  stub = await startPostgrestStub();
  client = createClient<Database>(stub.url, 'cle-anon-de-test', STUB_CLIENT_OPTIONS);
});

afterEach(() => {
  stub.requests.length = 0;
});

after(() => stub.close());

const body = (i = 0) => JSON.parse(stub.requests[i]?.body ?? '{}');

describe('le nombre de la pastille', () => {
  it('appelle notification_badge et rend le nombre', async () => {
    stub.enqueue(4);
    assert.equal(await fetchNotificationBadge(client), 4);
    assert.equal(stub.requests[0]?.path, '/rest/v1/rpc/notification_badge');
  });

  it('rien de lisible : zéro, jamais un nombre négatif', async () => {
    stub.enqueue(null);
    assert.equal(await fetchNotificationBadge(client), 0);
    stub.enqueue(-2);
    assert.equal(await fetchNotificationBadge(client), 0);
  });

  it('une erreur remonte son message', async () => {
    stub.enqueue({ message: 'permission denied for function notification_badge', code: '42501' }, 403);
    await assert.rejects(fetchNotificationBadge(client), /permission denied/);
  });
});

describe('la zone, page par page', () => {
  it('la première page : sans curseur, 30 lignes demandées', async () => {
    stub.enqueue([]);
    assert.deepEqual(await fetchNotifications(client, null), []);
    assert.equal(stub.requests[0]?.path, '/rest/v1/rpc/list_notifications');
    assert.deepEqual(body(), { p_before: null, p_before_key: null, p_limit: NOTIFICATION_PAGE });
  });

  it('les suivantes : la date et la clé de la dernière ligne lue', async () => {
    stub.enqueue([{ kind: 'follow', group_key: 'follow' }]);
    const rows = await fetchNotifications(client, { before: '2026-10-27T10:00:00.000Z', beforeKey: 'like:x' });
    assert.equal(rows.length, 1);
    assert.deepEqual(body(), { p_before: '2026-10-27T10:00:00.000Z', p_before_key: 'like:x', p_limit: NOTIFICATION_PAGE });
  });

  it('une erreur remonte son message', async () => {
    stub.enqueue({ message: 'boom', code: 'XX000' }, 500);
    await assert.rejects(fetchNotifications(client, null), /boom/);
  });
});

describe('la date de lecture', () => {
  it('envoie la date de la ligne la plus récente, rend celle que la base a posée', async () => {
    stub.enqueue('2026-10-27T10:00:00+00:00');
    assert.equal(await markNotificationsSeen(client, '2026-10-27T10:00:00.000Z'), '2026-10-27T10:00:00+00:00');
    assert.equal(stub.requests[0]?.path, '/rest/v1/rpc/mark_notifications_seen');
    assert.deepEqual(body(), { p_until: '2026-10-27T10:00:00.000Z' });
  });

  it('sans profil, la base ne pose rien, l\'app non plus', async () => {
    stub.enqueue(null);
    assert.equal(await markNotificationsSeen(client, '2026-10-27T10:00:00.000Z'), null);
  });
});

describe('les clés', () => {
  it('le nombre et la liste dépendent de qui lit', () => {
    assert.notDeepEqual(notificationBadgeKey('a'), notificationBadgeKey('b'));
    assert.notDeepEqual(notificationListKey('a'), notificationBadgeKey('a'));
    assert.equal(notificationBadgeKey('a')[0], notificationListKey('a')[0]);
  });
});
