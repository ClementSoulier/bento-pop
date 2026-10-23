import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  beaconDay,
  clientAddress,
  formatVisits,
  isBotUserAgent,
  isPrefetch,
  parseBentoId,
  recordWebVisit,
  visitFingerprint,
  type VisitClient,
} from './visits';

const BENTO = '3f2b8c1e-5d4a-4b6f-9e0d-1a2b3c4d5e6f';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';
const CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const CUBOT =
  'Mozilla/5.0 (Linux; Android 10; CUBOT X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

const headersOf = (values: Record<string, string>) => new Headers(values);

describe('parseBentoId', () => {
  it('accepte un identifiant de bento, en minuscules', () => {
    assert.equal(parseBentoId(BENTO), BENTO);
    assert.equal(parseBentoId(BENTO.toUpperCase()), BENTO);
  });

  it('rejette ce qui n’en a pas la forme', () => {
    for (const value of [
      null,
      undefined,
      '',
      'b-1',
      `${BENTO} `,
      `${BENTO}0`,
      "'; drop table bentos;--",
    ]) {
      assert.equal(parseBentoId(value), null, `devrait rejeter « ${value} »`);
    }
  });
});

describe('formatVisits', () => {
  it('met zéro et un au singulier', () => {
    assert.equal(formatVisits(0), '0\u00a0visite');
    assert.equal(formatVisits(1), '1\u00a0visite');
    assert.equal(formatVisits(2), '2\u00a0visites');
  });

  it('sépare les milliers à la française, sans couper le nombre de son mot', () => {
    assert.equal(formatVisits(1234), '1\u202f234\u00a0visites');
  });
});

describe('isBotUserAgent', () => {
  it('laisse passer les navigateurs, Cubot compris', () => {
    for (const ua of [IPHONE, CHROME, CUBOT]) {
      assert.equal(isBotUserAgent(ua), false, ua);
    }
  });

  it('écarte les robots d’aperçu, les moteurs et les scripts', () => {
    for (const ua of [
      'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'WhatsApp/2.23.20.0',
      'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
      'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
      'TelegramBot (like TwitterBot)',
      'Twitterbot/1.0',
      'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.0.0 Safari/537.36',
      'curl/8.7.1',
      'python-requests/2.32.3',
      'node-fetch/1.0',
    ]) {
      assert.equal(isBotUserAgent(ua), true, ua);
    }
  });

  it('tient un navigateur sans identité pour un script', () => {
    assert.equal(isBotUserAgent(null), true);
    assert.equal(isBotUserAgent(''), true);
    assert.equal(isBotUserAgent('   '), true);
  });
});

describe('isPrefetch', () => {
  it('reconnaît le préchargement et le prérendu', () => {
    assert.equal(isPrefetch(headersOf({ 'sec-purpose': 'prefetch' })), true);
    assert.equal(isPrefetch(headersOf({ 'sec-purpose': 'prefetch;prerender' })), true);
    assert.equal(isPrefetch(headersOf({ purpose: 'prefetch' })), true);
    assert.equal(isPrefetch(headersOf({ 'x-moz': 'prefetch' })), true);
  });

  it('laisse passer un affichage ordinaire', () => {
    assert.equal(isPrefetch(headersOf({})), false);
  });
});

describe('clientAddress', () => {
  it('prend la dernière adresse, celle que le proxy a vue, et non celle qu’envoie le visiteur', () => {
    assert.equal(clientAddress(headersOf({ 'x-forwarded-for': '203.0.113.7' })), '203.0.113.7');
    assert.equal(
      clientAddress(headersOf({ 'x-forwarded-for': ' 192.0.2.66 , 203.0.113.7 ' })),
      '203.0.113.7',
    );
  });

  it('se rabat sur X-Real-IP, puis sur rien', () => {
    assert.equal(clientAddress(headersOf({ 'x-real-ip': '198.51.100.4' })), '198.51.100.4');
    assert.equal(clientAddress(headersOf({})), null);
    assert.equal(clientAddress(headersOf({ 'x-forwarded-for': ' , ' })), null);
  });
});

describe('visitFingerprint', () => {
  it('assemble l’adresse et le navigateur, dans la limite de la base', () => {
    assert.equal(visitFingerprint('203.0.113.7', 'UA'), '203.0.113.7|UA');
    assert.equal(visitFingerprint('203.0.113.7', 'x'.repeat(5000)).length, 1024);
  });
});

describe('beaconDay', () => {
  it('rend le jour de Paris, minuit compris', () => {
    // Heure d'été : Paris a deux heures d'avance sur UTC.
    assert.equal(beaconDay(new Date('2026-10-23T21:59:00Z')), '2026-10-23');
    assert.equal(beaconDay(new Date('2026-10-23T22:00:00Z')), '2026-10-24');
    // Heure d'hiver, et un changement d'année.
    assert.equal(beaconDay(new Date('2026-12-31T23:30:00Z')), '2027-01-01');
  });

  it('suit le passage à l’heure d’hiver du 25 octobre 2026', () => {
    assert.equal(beaconDay(new Date('2026-10-25T22:59:00Z')), '2026-10-25');
    assert.equal(beaconDay(new Date('2026-10-25T23:00:00Z')), '2026-10-26');
  });
});

/** Un client qui note ses appels et rend ce qu'on lui dit. */
function fakeClient(error: { message: string; code?: string } | null = null) {
  const calls: Parameters<VisitClient['rpc']>[] = [];
  const client: VisitClient = {
    rpc(fn, args) {
      calls.push([fn, args]);
      return Promise.resolve({ error });
    },
  };
  return { client, calls };
}

const VISITOR = { 'user-agent': IPHONE, 'x-forwarded-for': '203.0.113.7' };

describe('recordWebVisit', () => {
  it('compte une visite, avec l’empreinte et le secret', async () => {
    const { client, calls } = fakeClient();
    const outcome = await recordWebVisit({
      bentoId: BENTO,
      headers: headersOf(VISITOR),
      secret: 's',
      client,
    });
    assert.equal(outcome, 'recorded');
    assert.deepEqual(calls, [
      [
        'record_bento_visit_web',
        { p_bento: BENTO, p_fingerprint: `203.0.113.7|${IPHONE}`, p_secret: 's' },
      ],
    ]);
  });

  it('ne demande rien à la base pour ce qui ne compte pas', async () => {
    const cases: [string, Parameters<typeof recordWebVisit>[0]][] = [
      ['invalid', { bentoId: 'b-1', headers: headersOf(VISITOR), secret: 's', client: null }],
      [
        'bot',
        {
          bentoId: BENTO,
          headers: headersOf({ ...VISITOR, 'user-agent': 'WhatsApp/2.23' }),
          secret: 's',
          client: null,
        },
      ],
      [
        'prefetch',
        {
          bentoId: BENTO,
          headers: headersOf({ ...VISITOR, 'sec-purpose': 'prefetch' }),
          secret: 's',
          client: null,
        },
      ],
      [
        'no-address',
        { bentoId: BENTO, headers: headersOf({ 'user-agent': IPHONE }), secret: 's', client: null },
      ],
      [
        'disabled',
        { bentoId: BENTO, headers: headersOf(VISITOR), secret: undefined, client: null },
      ],
    ];
    for (const [expected, input] of cases) {
      const { client, calls } = fakeClient();
      const outcome = await recordWebVisit({ ...input, client: input.secret ? client : null });
      assert.equal(outcome, expected);
      assert.equal(calls.length, 0, `${expected} : la base a été interrogée`);
    }
  });

  it('attend sa mise en service quand le coffre n’a pas le secret', async () => {
    const { client } = fakeClient({ code: '55000', message: 'Le comptage web attend le secret.' });
    assert.equal(
      await recordWebVisit({ bentoId: BENTO, headers: headersOf(VISITOR), secret: 's', client }),
      'disabled',
    );
  });

  it('rend une erreur, sans lever, pour un secret refusé ou une base en panne', async () => {
    const original = console.error;
    console.error = () => {};
    try {
      const { client: refused } = fakeClient({ code: '42501', message: 'Secret refusé.' });
      assert.equal(
        await recordWebVisit({
          bentoId: BENTO,
          headers: headersOf(VISITOR),
          secret: 's',
          client: refused,
        }),
        'error',
      );
      const broken: VisitClient = { rpc: () => Promise.reject(new Error('réseau')) };
      assert.equal(
        await recordWebVisit({
          bentoId: BENTO,
          headers: headersOf(VISITOR),
          secret: 's',
          client: broken,
        }),
        'error',
      );
    } finally {
      console.error = original;
    }
  });
});
