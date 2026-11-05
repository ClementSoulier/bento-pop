/**
 * Les largeurs des deux polices du bento (chantier 32), pour savoir avant de
 * dessiner si un mot tient dans sa case : Fredoka SemiCondensed Bold pour les
 * titres, Fredoka SemiBold pour la puce qui porte une question. Des capitales,
 * les seules que ces textes écrivent. `tile-metrics.test.ts` les relit dans les
 * fichiers de police : une table périmée s'y voit.
 *
 * Aucun import de `react-native` : les tests lisent ce module sous `node:test`.
 */

/** Largeur d'avance en em, par groupes de caractères de même largeur. */
type AdvanceGroups = readonly (readonly [string, number])[];

export const TILE_TITLE_ADVANCES: AdvanceGroups = [
  ["'", 0.189],
  [' ', 0.218],
  ['’;', 0.227],
  ['.', 0.23],
  [',:', 0.232],
  ['!', 0.25],
  ['IÌÍÎÏ', 0.256],
  ['()', 0.33],
  ['-', 0.353],
  ['1', 0.372],
  ['"', 0.392],
  ['+', 0.451],
  ['?', 0.459],
  ['/', 0.463],
  ['*', 0.472],
  ['5', 0.479],
  ['69', 0.502],
  ['7', 0.507],
  ['S', 0.511],
  ['J', 0.515],
  ['8', 0.522],
  ['L', 0.527],
  ['EÈÉÊË', 0.532],
  ['4', 0.535],
  ['F', 0.539],
  ['2', 0.541],
  ['03', 0.546],
  ['K', 0.564],
  ['P', 0.566],
  ['R', 0.577],
  ['Z', 0.578],
  ['B', 0.584],
  ['T', 0.59],
  ['CÇ', 0.592],
  ['H', 0.602],
  ['«', 0.606],
  ['»', 0.608],
  ['D', 0.609],
  ['YŸ', 0.624],
  ['AÀÁÂÃÄÅ', 0.629],
  ['UÙÚÛÜ', 0.632],
  ['X', 0.639],
  ['G', 0.644],
  ['OÒÓÔÕÖ', 0.65],
  ['NÑ', 0.652],
  ['#', 0.658],
  ['&', 0.663],
  ['V', 0.672],
  ['Q', 0.707],
  ['Ø', 0.721],
  ['%', 0.742],
  ['_', 0.744],
  ['…', 0.747],
  ['M', 0.781],
  ['@', 0.815],
  ['W', 0.907],
  ['Æ', 0.921],
  ['Œ', 0.927],
];

export const TAG_LABEL_ADVANCES: AdvanceGroups = [
  ["'", 0.189],
  ['’', 0.199],
  ['.', 0.217],
  [';', 0.218],
  [',', 0.224],
  [':', 0.225],
  ['IÌÍÎÏ', 0.232],
  [' ', 0.241],
  ['!', 0.242],
  ['()', 0.364],
  ['"', 0.378],
  ['1', 0.383],
  ['-', 0.411],
  ['*', 0.477],
  ['?', 0.481],
  ['/', 0.498],
  ['5', 0.501],
  ['+', 0.506],
  ['69', 0.526],
  ['7', 0.533],
  ['J', 0.536],
  ['S', 0.546],
  ['8', 0.547],
  ['4', 0.549],
  ['L', 0.565],
  ['03', 0.572],
  ['2', 0.577],
  ['Z', 0.59],
  ['K', 0.595],
  ['P', 0.597],
  ['EÈÉÊË»', 0.61],
  ['R', 0.611],
  ['«', 0.616],
  ['BF', 0.619],
  ['YŸ', 0.638],
  ['CÇ', 0.643],
  ['T', 0.648],
  ['H', 0.662],
  ['D', 0.667],
  ['NÑ', 0.683],
  ['UÙÚÛÜ', 0.688],
  ['X', 0.691],
  ['&', 0.702],
  ['AÀÁÂÃÄÅ', 0.709],
  ['G', 0.715],
  ['OÒÓÔÕÖ', 0.725],
  ['V', 0.727],
  ['#', 0.73],
  ['…', 0.739],
  ['Ø', 0.74],
  ['_', 0.783],
  ['Q', 0.792],
  ['%', 0.794],
  ['M', 0.814],
  ['@', 0.839],
  ['W', 0.953],
  ['Œ', 1.032],
  ['Æ', 1.088],
];

function advanceMap(groups: AdvanceGroups): ReadonlyMap<string, number> {
  return new Map(groups.flatMap(([chars, em]) => [...chars].map((c) => [c, em] as const)));
}

const TILE_TITLE = advanceMap(TILE_TITLE_ADVANCES);
const TAG_LABEL = advanceMap(TAG_LABEL_ADVANCES);

/** Un caractère hors de la table, le plus souvent dessiné par une autre police. */
const UNKNOWN_ADVANCE = 1;

function textWidth(
  advances: ReadonlyMap<string, number>,
  text: string,
  fontSize: number,
  letterSpacing: number,
): number {
  const chars = [...text.toLocaleUpperCase('fr')];
  let em = 0;
  for (const char of chars) em += advances.get(char === '\u00a0' ? ' ' : char) ?? UNKNOWN_ADVANCE;
  return em * fontSize + letterSpacing * chars.length;
}

/** La largeur d'un titre de case, en capitales. */
export function tileTitleWidth(text: string, fontSize: number, letterSpacing: number): number {
  return textWidth(TILE_TITLE, text, fontSize, letterSpacing);
}

/** La largeur du texte d'une puce, en capitales. */
export function tagLabelWidth(text: string, fontSize: number, letterSpacing: number): number {
  return textWidth(TAG_LABEL, text, fontSize, letterSpacing);
}
