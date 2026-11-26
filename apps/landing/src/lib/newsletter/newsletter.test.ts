import assert from 'node:assert/strict';
import { test } from 'node:test';

import { postToDiscord, subscriptionMessage, unsubscriptionMessage } from './discord';
import { HONEYPOT_FIELD, isHoneypotFilled, parseEmail, parseSource } from './form';
import { createRateLimiter } from './rate-limit';

test('une adresse se normalise en minuscules, sans espaces autour', () => {
  assert.equal(parseEmail('  Clement@Exemple.FR '), 'clement@exemple.fr');
  assert.equal(parseEmail('prenom.nom+bp@exemple.co'), 'prenom.nom+bp@exemple.co');
});

test('ce qui n’est pas une adresse est refusé', () => {
  for (const value of ['', 'clement', 'clement@', '@exemple.fr', 'a b@exemple.fr', null, 42]) {
    assert.equal(parseEmail(value), null, String(value));
  }
  assert.equal(parseEmail(`${'a'.repeat(250)}@exemple.fr`), null);
});

test('une provenance inconnue compte pour l’accueil', () => {
  assert.equal(parseSource('footer'), 'footer');
  assert.equal(parseSource('home'), 'home');
  assert.equal(parseSource('landing'), 'home');
  assert.equal(parseSource(null), 'home');
});

test('le champ piège rempli trahit un robot', () => {
  const human = new FormData();
  human.set('email', 'a@exemple.fr');
  human.set(HONEYPOT_FIELD, '');
  assert.equal(isHoneypotFilled(human), false);

  const bot = new FormData();
  bot.set(HONEYPOT_FIELD, 'https://spam.example');
  assert.equal(isHoneypotFilled(bot), true);
});

test('la limite laisse passer cinq envois par fenêtre, puis bloque', () => {
  const limiter = createRateLimiter({ limit: 5, windowMs: 1000 });
  for (let i = 0; i < 5; i += 1) assert.equal(limiter.take('ip', i), true);
  assert.equal(limiter.take('ip', 10), false);
  // Une autre adresse IP a son propre compte.
  assert.equal(limiter.take('autre', 10), true);
  // La fenêtre passée, les envois reprennent.
  assert.equal(limiter.take('ip', 1005), true);
});

test('la limite oublie les plus anciennes adresses au-delà de maxKeys', () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 1000, maxKeys: 2 });
  assert.equal(limiter.take('a', 0), true);
  assert.equal(limiter.take('b', 0), true);
  assert.equal(limiter.take('c', 0), true);
  // `a`, la plus ancienne, a été oubliée : elle repasse.
  assert.equal(limiter.take('a', 1), true);
  assert.equal(limiter.take('c', 1), false);
});

test('le message Discord dit l’événement et le nombre, jamais d’adresse', () => {
  assert.equal(subscriptionMessage(1), '📬 Nouvelle inscription à la newsletter (1 inscrit)');
  assert.equal(
    subscriptionMessage(1234),
    `📬 Nouvelle inscription à la newsletter (1${' '}234 inscrits)`,
  );
  assert.equal(unsubscriptionMessage(0), '👋 Une désinscription de la newsletter (0 inscrit)');
  assert.equal(unsubscriptionMessage(null), '👋 Une désinscription de la newsletter');
});

test('sans webhook, rien ne part', async () => {
  let called = false;
  const fakeFetch = (async () => {
    called = true;
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  assert.equal(await postToDiscord(undefined, 'x', fakeFetch), 'skipped');
  assert.equal(await postToDiscord('  ', 'x', fakeFetch), 'skipped');
  assert.equal(await postToDiscord('pas une url', 'x', fakeFetch), 'skipped');
  assert.equal(called, false);
});

test('le webhook reçoit le texte, sans mention possible', async () => {
  let body: unknown = null;
  const fakeFetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    body = JSON.parse(String(init?.body));
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  const outcome = await postToDiscord('https://discord.test/api/webhooks/1/x', 'Bonjour', fakeFetch);
  assert.equal(outcome, 'sent');
  assert.deepEqual(body, { content: 'Bonjour', allowed_mentions: { parse: [] } });
});

test('une erreur de Discord ne remonte pas', async () => {
  const original = console.error;
  console.error = () => {};
  try {
    const refused = (async () => new Response('nope', { status: 429 })) as typeof fetch;
    assert.equal(await postToDiscord('https://discord.test/x', 'x', refused), 'failed');
    const down = (async () => {
      throw new Error('ECONNREFUSED');
    }) as typeof fetch;
    assert.equal(await postToDiscord('https://discord.test/x', 'x', down), 'failed');
  } finally {
    console.error = original;
  }
});
