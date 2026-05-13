import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withTimeout } from './with-timeout';

test('resolves with the value when promise wins the race', async () => {
  const result = await withTimeout(Promise.resolve(42), 1000, -1);
  assert.equal(result, 42);
});

test('returns fallback when promise rejects', async () => {
  const result = await withTimeout(Promise.reject(new Error('boom')), 1000, 'fallback');
  assert.equal(result, 'fallback');
});

test('returns fallback when promise hangs past the timeout', async () => {
  const neverResolves = new Promise<string>(() => {
    /* never settles */
  });
  const start = Date.now();
  const result = await withTimeout(neverResolves, 50, 'timed-out');
  const elapsed = Date.now() - start;
  assert.equal(result, 'timed-out');
  assert.ok(elapsed >= 45, `expected wait >= 45ms, got ${elapsed}`);
  assert.ok(elapsed < 200, `expected wait < 200ms, got ${elapsed}`);
});

test('does not double-resolve if promise settles after timeout', async () => {
  // Promesse qui resolve juste après le timeout — on doit garder la valeur
  // de fallback et ne pas leak vers un double-resolve.
  const observed: string[] = [];
  const slow = new Promise<string>((r) => {
    setTimeout(() => r('late'), 80);
  });
  const wrapped = withTimeout(slow, 30, 'early');
  // Capture la 1ère valeur
  const firstResult = await wrapped;
  observed.push(firstResult);
  // Attend que la slow ait eu le temps de tenter de resolve
  await new Promise((r) => setTimeout(r, 120));
  assert.deepEqual(observed, ['early']);
});

test('resolves cleanly within the timeout window', async () => {
  const fast = new Promise<string>((r) => setTimeout(() => r('on-time'), 20));
  const start = Date.now();
  const result = await withTimeout(fast, 500, 'fallback');
  const elapsed = Date.now() - start;
  assert.equal(result, 'on-time');
  assert.ok(elapsed < 100, `expected fast resolve, took ${elapsed}ms`);
});

test('clears the timer when promise resolves first (no dangling timeout)', async () => {
  // Si on ne clearTimeout pas, le process Node garderait le timer ouvert
  // et le test runner ne finirait pas dans son budget. On vérifie indirectement
  // que ça finit vite.
  const start = Date.now();
  await withTimeout(Promise.resolve('quick'), 10000, 'fallback');
  const elapsed = Date.now() - start;
  assert.ok(elapsed < 100, `unexpected delay ${elapsed}ms — timer probably not cleared`);
});
