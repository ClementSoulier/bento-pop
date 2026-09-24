import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  chapterAt,
  formatSpeed,
  formatSpokenTime,
  isRealEpisodeId,
  nextSpeed,
  parseTimeFragment,
  PLAYBACK_SPEEDS,
} from './podcast-player';

const CHAPITRES = [
  { label: 'Introduction', start_seconds: 0 },
  { label: 'La feuille de route', start_seconds: 1529 },
  { label: 'Le financement', start_seconds: 1647 },
];

test('trouve le chapitre en cours, bornes comprises', () => {
  assert.equal(chapterAt(CHAPITRES, 0)?.label, 'Introduction');
  assert.equal(chapterAt(CHAPITRES, 1528)?.label, 'Introduction');
  assert.equal(chapterAt(CHAPITRES, 1529)?.label, 'La feuille de route');
  assert.equal(chapterAt(CHAPITRES, 5000)?.label, 'Le financement');
});

test('les chapitres peuvent arriver dans le désordre, ou manquer', () => {
  assert.equal(chapterAt([...CHAPITRES].reverse(), 1600)?.label, 'La feuille de route');
  assert.equal(chapterAt([{ label: 'Tard', start_seconds: 60 }], 10), null);
  assert.equal(chapterAt([], 10), null);
});

test('lit les liens vers un instant de l’épisode', () => {
  assert.equal(parseTimeFragment('#t=754'), 754);
  assert.equal(parseTimeFragment('#t=12:34'), 754);
  assert.equal(parseTimeFragment('#t=1:02:03'), 3723);
  assert.equal(parseTimeFragment('t=90'), 90);
});

test('ignore tout ce qui n’est pas un instant', () => {
  for (const hash of ['', '#', '#main', '#t=', '#t=abc', '#t=1:2:3:4', '#t=-5', '#t=12:345']) {
    assert.equal(parseTimeFragment(hash), null, hash);
  }
});

test('fait défiler les vitesses et revient au début', () => {
  let v: number = PLAYBACK_SPEEDS[0];
  const vues = [v];
  for (let i = 0; i < PLAYBACK_SPEEDS.length; i++) vues.push((v = nextSpeed(v)));
  assert.deepEqual(vues, [1, 1.25, 1.5, 2, 0.75, 1]);
  assert.equal(nextSpeed(3), 1);
});

test('écrit les vitesses à la française', () => {
  assert.equal(formatSpeed(1), '1×');
  assert.equal(formatSpeed(1.25), '1,25×');
  assert.equal(formatSpeed(0.75), '0,75×');
});

test('dit l’instant en toutes lettres pour les lecteurs d’écran', () => {
  assert.equal(formatSpokenTime(0), '0 seconde');
  assert.equal(formatSpokenTime(61), '1 minute 1 seconde');
  assert.equal(formatSpokenTime(754), '12 minutes 34 secondes');
  assert.equal(formatSpokenTime(3600), '1 heure');
  assert.equal(formatSpokenTime(Number.NaN), '0 seconde');
});

test('reconnaît les identifiants de plateforme provisoires', () => {
  assert.equal(isRealEpisodeId('spotify', '6OL9IBh97TeLAz98Dx2EQA'), true);
  assert.equal(isRealEpisodeId('spotify', 'A_REMPLACER'), false);
  assert.equal(isRealEpisodeId('spotify', 'TODO_debats-2-les-reseaux'), false);
  assert.equal(isRealEpisodeId('spotify', ''), false);
  assert.equal(isRealEpisodeId('deezer', '1002514832'), true);
  assert.equal(isRealEpisodeId('apple', '1000712345678'), true);
  assert.equal(isRealEpisodeId('apple', 'A_REMPLACER'), false);
  assert.equal(isRealEpisodeId('youtube', 'abc'), false);
});
