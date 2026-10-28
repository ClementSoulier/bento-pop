import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { colors, palette, type ColorToken, type PaletteToken } from './tokens';

/**
 * Les contrastes que le design annonce, prouvés (chantier 30, D16) : chaque
 * couple que `tokens.json` nomme dans ses notes d'usage, dans les deux thèmes.
 * 4,5:1 pour un texte, 3:1 pour une icône, un contour de contrôle ou l'anneau
 * de focus (WCAG 1.4.3 et 1.4.11). Un token changé qui en ferait tomber un
 * échoue ici, avant d'atteindre un écran.
 */

type Token = ColorToken | PaletteToken;

function hex(theme: 'light' | 'dark', token: Token): string {
  const value =
    token in colors[theme] ? colors[theme][token as ColorToken] : palette[token as PaletteToken];
  assert.match(value, /^#[0-9a-f]{6}$/, `${token} n'est pas une couleur pleine`);
  return value;
}

/** Luminance relative, au sens du WCAG 2. */
function luminance(color: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(color.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

/** Le texte et les fonds sur lesquels sa note d'usage le pose. */
const TEXT_PAIRS: [Token, Token[]][] = [
  ['text-primary', ['bg-app', 'bg-surface', 'bg-sunken', 'bg-elevated', 'status-live-bg']],
  ['text-secondary', ['bg-app', 'bg-surface', 'bg-sunken']],
  ['text-tertiary', ['bg-app', 'bg-surface', 'bg-sunken']],
  ['text-on-brand', ['bg-brand', 'accent']],
  ['text-on-brand-muted', ['bg-brand']],
  ['text-on-inverse', ['bg-inverse']],
  ['text-danger', ['bg-surface', 'bg-sunken']],
  ['text-success', ['bg-surface']],
  ['on-accent', ['accent']],
  ['on-accent-soft', ['accent-soft']],
  ['on-danger', ['danger']],
  ['on-danger-soft', ['danger-soft']],
  ['rice-100', ['toast-bg']],
  ['yolk-300', ['toast-bg']],
  ['nori-900', ['cat-film', 'cat-serie', 'cat-artiste', 'cat-son', 'cat-crea', 'cat-lieu']],
];

/** Ce qui n'est pas du texte : contours de contrôles, anneau de focus, coche. */
const OTHER_PAIRS: [Token, Token[]][] = [
  ['border-strong', ['bg-surface', 'bg-sunken']],
  ['focus-ring', ['bg-app', 'bg-surface', 'bg-sunken', 'bg-elevated']],
  ['control-on-fg', ['control-on']],
];

const below = (theme: 'light' | 'dark', pairs: [Token, Token[]][], minimum: number) =>
  pairs.flatMap(([fg, bgs]) =>
    bgs
      .map((bg) => ({ fg, bg, ratio: contrast(hex(theme, fg), hex(theme, bg)) }))
      .filter(({ ratio }) => ratio < minimum)
      .map(({ fg, bg, ratio }) => `${fg} sur ${bg} : ${ratio.toFixed(2)}:1`),
  );

describe('contrastes du design system v2', () => {
  for (const theme of ['light', 'dark'] as const) {
    it(`tiennent 4,5:1 pour chaque texte nommé, thème ${theme}`, () => {
      assert.deepEqual(below(theme, TEXT_PAIRS, 4.5), []);
    });

    it(`tiennent 3:1 pour les contours, le focus et la coche, thème ${theme}`, () => {
      assert.deepEqual(below(theme, OTHER_PAIRS, 3), []);
    });
  }

  it('donnent au blanc 4,5:1 sur les teintes -700 du garde-manger, et à l’encre 8,4:1 sur les -300', () => {
    const tints = ['ume', 'thon', 'sakura', 'shiso', 'ramune', 'wasabi'] as const;
    for (const tint of tints) {
      const deep = contrast(palette[`${tint}-700`], '#ffffff');
      const soft = contrast(palette[`${tint}-300`], palette['nori-900']);
      assert.ok(deep >= 4.5, `${tint}-700 sous du blanc : ${deep.toFixed(2)}:1`);
      assert.ok(soft >= 8.4, `${tint}-300 sous nori-900 : ${soft.toFixed(2)}:1`);
    }
  });

  it('mesure le WCAG comme lui : noir sur blanc, 21:1', () => {
    assert.equal(Math.round(contrast('#000000', '#ffffff') * 100) / 100, 21);
  });
});
