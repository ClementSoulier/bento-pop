import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { CURVE, DURATION, motionFor, type Duration } from './motion';

const BUNDLE_CSS = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'docs',
  'design-v2',
  'design-system',
  'code-source',
  'src',
  'bundle.css',
);

/** Les variables `--dur-*` et `--ease-*` du dossier de la refonte, qui fait foi. */
function designMotion() {
  const css = readFileSync(BUNDLE_CSS, 'utf8');
  const durations = Object.fromEntries(
    [...css.matchAll(/--dur-([a-z]+):\s*(\d+)ms;/g)].map(([, name, ms]) => [name, Number(ms)]),
  );
  const curves = Object.fromEntries(
    [...css.matchAll(/--ease-([a-z]+):\s*cubic-bezier\(([^)]+)\);/g)].map(([, name, points]) => [
      name,
      (points ?? '').split(',').map(Number),
    ]),
  );
  return { durations, curves };
}

describe('mouvement du design system v2', () => {
  it('a les durées et les courbes du dossier de la refonte', () => {
    const { durations, curves } = designMotion();
    assert.deepEqual(durations, DURATION);
    assert.deepEqual(curves, CURVE);
  });

  it('garde les durées et les courbes du design quand rien n’est réduit', () => {
    const motion = motionFor(false);
    assert.equal(motion.reduced, false);
    assert.deepEqual(motion.move('fast'), { duration: 120, curve: 'standard' });
    assert.deepEqual(motion.move('base', 'pop'), { duration: 200, curve: 'pop' });
    assert.deepEqual(motion.enter('slow'), { kind: 'move', duration: 320, curve: 'pop' });
    assert.deepEqual(motion.exit('base'), { kind: 'move', duration: 200, curve: 'exit' });
    assert.equal(motion.confetti, true);
    assert.equal(motion.wiggle, true);
    assert.equal(motion.pulse, true);
    assert.equal(motion.spin, 800);
  });

  it('réduit, ne déplace plus rien et ne rebondit plus', () => {
    const motion = motionFor(true);
    assert.equal(motion.reduced, true);
    for (const duration of Object.keys(DURATION) as Duration[]) {
      for (const curve of ['standard', 'pop', 'exit'] as const) {
        assert.deepEqual(motion.move(duration, curve), { duration: 0, curve: 'standard' });
      }
    }
  });

  it('réduit, fait apparaître et partir en fondus de 120 ms', () => {
    const motion = motionFor(true);
    const fade = { kind: 'fade', duration: 120, curve: 'standard' };
    assert.deepEqual(motion.enter('slow'), fade);
    assert.deepEqual(motion.enter('base', 'pop'), fade);
    assert.deepEqual(motion.exit('slow'), fade);
  });

  it('réduit, arrête confettis, dandinement et pulsation, et ralentit le Spinner', () => {
    const motion = motionFor(true);
    assert.equal(motion.confetti, false);
    assert.equal(motion.wiggle, false);
    assert.equal(motion.pulse, false);
    assert.equal(motion.spin, 2400);
  });

  it('réduit ou non, garde aux couleurs et aux opacités leur durée', () => {
    for (const reduced of [false, true]) {
      assert.deepEqual(motionFor(reduced).fade('base'), { duration: 200, curve: 'standard' });
    }
  });
});
