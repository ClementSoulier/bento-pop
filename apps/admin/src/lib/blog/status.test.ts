import assert from 'node:assert/strict';
import { test } from 'node:test';

import { postState } from './status';

const NOW = Date.parse('2026-11-26T12:00:00Z');

test('un brouillon reste un brouillon, quelle que soit sa date', () => {
  assert.equal(postState('draft', null, NOW), 'draft');
  assert.equal(postState('draft', '2020-01-01T00:00:00Z', NOW), 'draft');
});

test('un article publié à date future est programmé', () => {
  assert.equal(postState('published', '2026-11-26T12:00:01Z', NOW), 'scheduled');
  assert.equal(postState('published', '2026-11-26T12:00:00Z', NOW), 'published');
  assert.equal(postState('published', null, NOW), 'published');
});
