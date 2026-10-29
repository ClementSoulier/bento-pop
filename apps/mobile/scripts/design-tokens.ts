/**
 * Écrit `src/design/tokens.ts` depuis le dossier de la refonte,
 * `docs/design-v2/design-system/tokens.json` (chantier 30, D6).
 *
 * Le dossier fait foi : les couleurs se résolvent thème par thème, chaque
 * sémantique remplacée par la valeur de la primitive qu'elle nomme ; les
 * tailles perdent leur `px`, l'approche des textes passe des `em` aux points.
 * `tokens.test.ts` régénère en mémoire et compare : une retouche à la main du
 * fichier écrit le fait échouer.
 *
 *   cd apps/mobile
 *   pnpm design:tokens
 *
 * Cf. `docs/UX-30-SOCLE-DESIGN-SYSTEM.md` §4.1.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const TOKENS_JSON = join(
  __dirname,
  '..',
  '..',
  '..',
  'docs',
  'design-v2',
  'design-system',
  'tokens.json',
);
export const TOKENS_TS = join(__dirname, '..', 'src', 'design', 'tokens.ts');

type Themed = { light: string; dark: string };
type ColorToken = { name: string; value: string | Themed };
type TypeStyle = {
  name: string;
  fontSize: string;
  lineHeight: string;
  fontWeight: number;
  letterSpacing?: string;
  textTransform?: string;
};
type Named = { name: string; value: string };
type ShadowToken = { name: string; value: Themed };

export type DesignTokens = {
  color: { tokens: ColorToken[] };
  type: { groups: { family: string; styles: TypeStyle[] }[] };
  spacing: { tokens: Named[] };
  radius: { tokens: Named[] };
  shadow: { tokens: ShadowToken[] };
  border: { tokens: Named[] };
  size: { tokens: Named[] };
};

const THEMES = ['light', 'dark'] as const;

function px(value: string): number {
  const match = /^(-?\d+(?:\.\d+)?)px$/.exec(value);
  if (!match) throw new Error(`Valeur sans px : « ${value} »`);
  return Number(match[1]);
}

/** `0.01em` sur 44 points : 0,44. Arrondi au centième, comme un point d'écran. */
function letterSpacing(value: string | undefined, fontSize: number): number | undefined {
  if (value === undefined) return undefined;
  const match = /^(-?\d+(?:\.\d+)?)em$/.exec(value);
  if (!match) throw new Error(`Approche sans em : « ${value} »`);
  return Math.round(Number(match[1]) * fontSize * 100) / 100;
}

/** La valeur d'une couleur dans un thème, références suivies jusqu'à une valeur écrite. */
function resolveColor(
  tokens: Map<string, ColorToken>,
  name: string,
  theme: 'light' | 'dark',
  seen: string[] = [],
): string {
  if (seen.includes(name)) throw new Error(`Référence circulaire : ${[...seen, name].join(' → ')}`);
  const token = tokens.get(name);
  if (!token) throw new Error(`Couleur inconnue : « ${name} »`);
  const value = typeof token.value === 'string' ? token.value : token.value[theme];
  const reference = /^\{([a-z0-9-]+)\}$/.exec(value);
  if (reference) return resolveColor(tokens, reference[1] ?? '', theme, [...seen, name]);
  if (!/^#[0-9a-f]{6}$/.test(value) && !/^rgba\(\d+,\d+,\d+,(?:0|1|0?\.\d+)\)$/.test(value)) {
    throw new Error(`Couleur illisible pour ${name} : « ${value} »`);
  }
  return value;
}

/** `3px 3px 0 0 #0e0e0e` : une ombre franche, décalée, sans flou ni étalement. */
function shadow(value: string): { x: number; y: number; color: string } {
  const match = /^(\d+)px (\d+)px 0 0 (#[0-9a-f]{6})$/.exec(value);
  if (!match) throw new Error(`Ombre qui n'est pas franche : « ${value} »`);
  return { x: Number(match[1]), y: Number(match[2]), color: match[3] ?? '' };
}

/** Une valeur en TypeScript, au style du dépôt : guillemets simples, clés nues quand elles le peuvent. */
export function literal(value: unknown): string {
  if (typeof value === 'string') return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  if (typeof value === 'number') return String(value);
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).map(([k, v]) => `${key(k)}: ${literal(v)}`);
    return `{ ${entries.join(', ')} }`;
  }
  throw new Error(`Valeur inattendue : ${String(value)}`);
}

export function key(name: string): string {
  return /^(?:[A-Za-z_$][\w$]*|\d+)$/.test(name) ? name : literal(name);
}

function record(entries: [string, unknown][], indent: string): string {
  return entries.map(([name, value]) => `${indent}${key(name)}: ${literal(value)},`).join('\n');
}

/** La source de `src/design/tokens.ts`. */
export function tokensSource(design: DesignTokens): string {
  const colorTokens = new Map(design.color.tokens.map((t) => [t.name, t]));
  const primitives = design.color.tokens.filter((t) => typeof t.value === 'string');
  const semantics = design.color.tokens.filter((t) => typeof t.value !== 'string');

  const styles = design.type.groups.flatMap((group) =>
    group.styles.map((style) => {
      const fontSize = px(style.fontSize);
      const entry: Record<string, unknown> = {
        family: group.family,
        fontSize,
        lineHeight: px(style.lineHeight),
        fontWeight: style.fontWeight,
      };
      const spacing = letterSpacing(style.letterSpacing, fontSize);
      if (spacing !== undefined) entry.letterSpacing = spacing;
      if (style.textTransform !== undefined) entry.textTransform = style.textTransform;
      return [style.name, entry] as [string, unknown];
    }),
  );

  const strip = (prefix: string) => (name: string) =>
    name.startsWith(prefix) ? name.slice(prefix.length) : name;
  const scale = (tokens: Named[], key: (name: string) => string) =>
    tokens.map((t) => [key(t.name), px(t.value)] as [string, unknown]);

  const lines = [
    '/**',
    ' * Généré par `scripts/design-tokens.ts` depuis',
    ' * `docs/design-v2/design-system/tokens.json` (chantier 30, D6) : ne pas',
    ' * modifier à la main, relancer `pnpm design:tokens`.',
    ' */',
    '',
    `export type ColorToken =\n${semantics.map((t) => `  | ${literal(t.name)}`).join('\n')};`,
    '',
    `export type PaletteToken =\n${primitives.map((t) => `  | ${literal(t.name)}`).join('\n')};`,
    '',
    '/** Les couleurs sémantiques, résolues pour chaque thème : les seules que le code emploie. */',
    "export const colors: Record<'light' | 'dark', Record<ColorToken, string>> = {",
    ...THEMES.flatMap((theme) => [
      `  ${theme}: {`,
      record(
        semantics.map((t) => [t.name, resolveColor(colorTokens, t.name, theme)]),
        '    ',
      ),
      '  },',
    ]),
    '};',
    '',
    '/** Les primitives, qui ne changent pas de thème : les teintes des avatars, par exemple. */',
    'export const palette: Record<PaletteToken, string> = {',
    record(
      primitives.map((t) => [t.name, t.value]),
      '  ',
    ),
    '};',
    '',
    '/** Les 22 styles de texte, en points ; `family` est le rôle de la police, cf. `type.ts`. */',
    'export const type = {',
    record(styles, '  '),
    '} as const;',
    '',
    'export const space = {',
    record(scale(design.spacing.tokens, strip('space-')), '  '),
    '} as const;',
    '',
    'export const radius = {',
    record(scale(design.radius.tokens, strip('radius-')), '  '),
    '} as const;',
    '',
    'export const border = {',
    record(scale(design.border.tokens, strip('border-')), '  '),
    '} as const;',
    '',
    'export const size = {',
    record(scale(design.size.tokens, strip('size-')), '  '),
    '} as const;',
    '',
    '/** Les ombres franches de chaque thème : décalées, sans flou, cf. `shadow.ts`. */',
    'export const shadow = {',
    ...THEMES.flatMap((theme) => [
      `  ${theme}: {`,
      record(
        design.shadow.tokens.map((t) => [strip('shadow-')(t.name), shadow(t.value[theme])]),
        '    ',
      ),
      '  },',
    ]),
    '} as const;',
    '',
  ];
  return lines.join('\n');
}

export function readDesignTokens(): DesignTokens {
  return JSON.parse(readFileSync(TOKENS_JSON, 'utf8')) as DesignTokens;
}

if (require.main === module) {
  writeFileSync(TOKENS_TS, tokensSource(readDesignTokens()));
  console.log(`Écrit : ${TOKENS_TS}`);
}
