import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isOptimizableImage } from './images';

test('un hôte connu passe par l’optimiseur en https seulement', () => {
  assert.equal(isOptimizableImage('https://i.ytimg.com/vi/x/hqdefault.jpg'), true);
  // `remotePatterns` n'autorise que le https : en http, next/image lèverait une erreur.
  assert.equal(isOptimizableImage('http://i.ytimg.com/vi/x/hqdefault.jpg'), false);
});

test('assets locaux acceptés, hôte inconnu ou adresse illisible refusés', () => {
  assert.equal(isOptimizableImage('/_next/static/media/popy.png'), true);
  assert.equal(isOptimizableImage('https://exemple.test/a.png'), false);
  assert.equal(isOptimizableImage('pas une url'), false);
});
