import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { readDesignTokens, TOKENS_TS, tokensSource } from '../../scripts/design-tokens';
import { colors, palette, radius, shadow, size, space, type } from './tokens';

/**
 * `tokens.ts` est écrit par `scripts/design-tokens.ts` depuis le dossier de la
 * refonte, qui fait foi (chantier 30, D6). Une retouche à la main du fichier,
 * ou un dossier changé sans relancer `pnpm design:tokens`, fait échouer le
 * premier test.
 */
describe('tokens du design system v2', () => {
  it('sont ceux que le dossier de la refonte donne, au caractère près', () => {
    assert.equal(readFileSync(TOKENS_TS, 'utf8'), tokensSource(readDesignTokens()));
  });

  it('résolvent chaque sémantique thème par thème', () => {
    assert.equal(colors.light['bg-app'], palette['rice-0']);
    assert.equal(colors.dark['bg-app'], palette['nori-900']);
    // Une valeur écrite d'un côté, une référence de l'autre.
    assert.equal(colors.light['text-success'], '#3f6b1e');
    assert.equal(colors.dark['text-success'], palette['wasabi-300']);
    assert.equal(colors.light.scrim, 'rgba(14,14,14,0.5)');
  });

  it('donnent aux deux thèmes les mêmes 57 couleurs', () => {
    assert.equal(Object.keys(colors.light).length, 57);
    assert.deepEqual(Object.keys(colors.dark), Object.keys(colors.light));
  });

  it('portent 22 styles de texte en points, l’approche passée des em aux points', () => {
    assert.equal(Object.keys(type).length, 22);
    assert.deepEqual(type['display-xl'], {
      family: 'display',
      fontSize: 44,
      lineHeight: 40,
      fontWeight: 900,
      letterSpacing: 0.44,
      textTransform: 'uppercase',
    });
    // 0,02 em sur 11 points.
    assert.equal(type['tile-s'].letterSpacing, 0.22);
    assert.deepEqual(type.body, { family: 'text', fontSize: 16, lineHeight: 22, fontWeight: 400 });
  });

  it('gardent les mesures du design, sans leur préfixe', () => {
    assert.equal(space[4], 16);
    assert.equal(radius.xl, 28);
    assert.equal(size.touch, 44);
    assert.equal(size.tabbar, 56);
    assert.equal(size['screen-margin'], 16);
  });

  it('ne connaissent que des ombres franches : décalées, sans flou', () => {
    assert.deepEqual(shadow.light.pop, { x: 3, y: 3, color: '#0e0e0e' });
    assert.deepEqual(shadow.dark['pop-lg'], { x: 5, y: 5, color: '#d8901e' });
  });
});
