/**
 * Écrit `src/design/icons.ts` depuis les 72 icônes du dossier de la refonte,
 * `docs/design-v2/design-system/icones/` (chantier 30, D3).
 *
 * Chaque icône y est un SVG Phosphor de 256 de côté, un seul tracé en
 * `currentColor`, dans trois graisses. Seules `bold` et `fill`, que le design
 * emploie, entrent dans l'app ; tout SVG d'une autre forme est refusé.
 * `icons.test.ts` régénère en mémoire et compare : une retouche à la main du
 * fichier écrit le fait échouer.
 *
 *   cd apps/mobile
 *   pnpm design:icons
 *
 * Cf. `docs/UX-30-SOCLE-DESIGN-SYSTEM.md` §4.4.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { key, literal } from './design-tokens';

export const ICONS_DIR = join(
  __dirname,
  '..',
  '..',
  '..',
  'docs',
  'design-v2',
  'design-system',
  'icones',
);
export const ICONS_TS = join(__dirname, '..', 'src', 'design', 'icons.ts');

const WEIGHTS = ['bold', 'fill'] as const;
type Weight = (typeof WEIGHTS)[number];

/** Le tracé de chaque icône, par nom Phosphor et par graisse. */
export type DesignIcons = [name: string, paths: Record<Weight, string>][];

const SVG =
  /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 256 256" fill="currentColor"><path d="([^"]+)"\/><\/svg>\s*$/;

function pathOf(file: string): string {
  const match = SVG.exec(readFileSync(file, 'utf8'));
  if (!match) throw new Error(`Icône qui n'est pas un seul tracé de 256 : ${file}`);
  return match[1] ?? '';
}

export function readDesignIcons(dir = ICONS_DIR): DesignIcons {
  const names = (weight: Weight) =>
    readdirSync(join(dir, weight))
      .filter((file) => file.endsWith('.svg'))
      .map((file) => file.slice(0, -'.svg'.length))
      .sort();
  const bold = names('bold');
  if (bold.join() !== names('fill').join()) {
    throw new Error('Les graisses bold et fill du dossier n’ont pas les mêmes icônes');
  }
  return bold.map((name) => [
    name,
    {
      bold: pathOf(join(dir, 'bold', `${name}.svg`)),
      fill: pathOf(join(dir, 'fill', `${name}.svg`)),
    },
  ]);
}

/** La source de `src/design/icons.ts`. */
export function iconsSource(icons: DesignIcons): string {
  const lines = [
    '/**',
    ' * Généré par `scripts/design-icons.ts` depuis',
    ' * `docs/design-v2/design-system/icones/` (chantier 30, D3) : ne pas modifier',
    ' * à la main, relancer `pnpm design:icons`.',
    ' */',
    '',
    `export type IconName =\n${icons.map(([name]) => `  | ${literal(name)}`).join('\n')};`,
    '',
    '/** Le tracé de chaque icône Phosphor dans un carré de 256, en `bold` et en `fill`. */',
    'export const icons: Record<IconName, { bold: string; fill: string }> = {',
    ...icons.flatMap(([name, paths]) => [
      `  ${key(name)}: {`,
      ...WEIGHTS.map((weight) => `    ${weight}: ${literal(paths[weight])},`),
      '  },',
    ]),
    '};',
    '',
  ];
  return lines.join('\n');
}

if (require.main === module) {
  writeFileSync(ICONS_TS, iconsSource(readDesignIcons()));
  console.log(`Écrit : ${ICONS_TS}`);
}
