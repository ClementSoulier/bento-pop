import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { type } from './tokens';
import { categoryOf, textStyle, type TextVariant } from './type';

const VARIANTS = Object.keys(type) as TextVariant[];

/**
 * La taille de texte du design system v2 (chantier 30, D1 et D8) : lecture et
 * action jusqu'à 200 %, le fixe à 130 %, taille, hauteur de ligne et approche
 * grandissant du même facteur.
 */
describe('styles de texte du design system v2', () => {
  it('rangent les 22 styles en trois catégories', () => {
    const by = (category: string) => VARIANTS.filter((v) => categoryOf(v) === category);
    assert.deepEqual(by('action'), ['label-l', 'label-m', 'label-s']);
    assert.deepEqual(by('fixe'), [
      'display-xl',
      'display-l',
      'display-m',
      'tile-xl',
      'tile-l',
      'tile-m',
      'tile-s',
      'tab-label',
    ]);
    assert.equal(by('lecture').length, 11);
  });

  it('suivent la taille du système jusqu’à 200 % pour la lecture et l’action', () => {
    for (const variant of ['body', 'title-1', 'caption', 'label-l'] as const) {
      const base = type[variant];
      assert.deepEqual(
        [
          textStyle(variant, 1.5).fontSize,
          textStyle(variant, 2).fontSize,
          textStyle(variant, 3.1).fontSize,
        ],
        [base.fontSize * 1.5, base.fontSize * 2, base.fontSize * 2],
        variant,
      );
    }
  });

  it('arrêtent à 130 % les cases, les titres en Extenda et les onglets', () => {
    for (const variant of ['tile-xl', 'display-xl', 'tab-label'] as const) {
      const base = type[variant];
      const { fontSize, lineHeight } = textStyle(variant, 2);
      assert.equal(fontSize, base.fontSize * 1.3, variant);
      assert.equal(lineHeight, base.lineHeight * 1.3, variant);
    }
  });

  it('font grandir l’approche avec la taille', () => {
    assert.equal(textStyle('display-xl', 1).letterSpacing, 0.44);
    assert.equal(textStyle('display-xl', 2).letterSpacing, 0.57);
    assert.equal(textStyle('body', 2).letterSpacing, undefined);
  });

  it('donnent à chaque rôle sa police, une famille par graisse', () => {
    assert.equal(textStyle('display-xl', 1).fontFamily, 'Extenda');
    assert.equal(textStyle('tile-m', 1).fontFamily, 'FredokaSemiCondensed-Bold');
    assert.equal(textStyle('title-1', 1).fontFamily, 'Fredoka-SemiBold');
    assert.equal(textStyle('tab-label', 1).fontFamily, 'Fredoka-Medium');
    assert.equal(textStyle('caption', 1).fontFamily, undefined);
    assert.equal(textStyle('caption', 1).fontWeight, '500');
    assert.equal(textStyle('title-1', 1).fontWeight, undefined);
  });

  it('ne nomment que des polices que l’app charge', () => {
    const fonts = readFileSync(join(__dirname, '..', 'lib', 'fonts.ts'), 'utf8');
    const families = new Set(VARIANTS.map((v) => textStyle(v, 1).fontFamily).filter(Boolean));
    for (const family of families) {
      assert.match(fonts, new RegExp(`^\\s*'?${family}'?:`, 'm'), `${family} absente de FONTS`);
    }
  });

  it('gardent les majuscules du design aux cases, aux titres de marque et aux sur-titres', () => {
    const upper = VARIANTS.filter((v) => textStyle(v, 1).textTransform === 'uppercase');
    assert.equal(upper.length, 8);
    assert.ok(upper.includes('eyebrow'));
  });
});
