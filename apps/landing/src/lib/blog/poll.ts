/**
 * Bloc « Sondage » d'un article : résultats figés d'un sondage du Thermomètre
 * (docs/BLOG.md D17). L'admin valide ces attributs à l'écriture ; ici on les relit
 * prudemment, et un bloc illisible n'est pas rendu.
 */

export type PollBlock = {
  question: string;
  weekTag: string | null;
  options: Array<{ label: string; votes: number }>;
  total: number;
  closedAt: string | null;
};

export function readPollAttrs(attrs: Record<string, unknown> | undefined): PollBlock | null {
  if (!attrs) return null;
  const { question, weekTag, options, closedAt } = attrs;
  if (typeof question !== 'string' || question.trim() === '') return null;
  if (!Array.isArray(options) || options.length < 2 || options.length > 8) return null;
  const clean: PollBlock['options'] = [];
  for (const o of options as Array<Record<string, unknown> | null>) {
    const label = o?.label;
    const votes = o?.votes;
    if (typeof label !== 'string' || label.trim() === '') return null;
    if (typeof votes !== 'number' || !Number.isInteger(votes) || votes < 0) return null;
    clean.push({ label, votes });
  }
  return {
    question,
    weekTag: typeof weekTag === 'string' && weekTag ? weekTag : null,
    options: clean,
    // Recalculé : on ne fait pas confiance à un total saisi à part.
    total: clean.reduce((sum, o) => sum + o.votes, 0),
    closedAt: typeof closedAt === 'string' && !Number.isNaN(Date.parse(closedAt)) ? closedAt : null,
  };
}

/** Pourcentages entiers qui totalisent 100 (plus fort reste), comme dans l'admin. */
export function pollPercentages(votes: number[]): number[] {
  const total = votes.reduce((a, b) => a + b, 0);
  if (total <= 0) return votes.map(() => 0);
  const exact = votes.map((v) => (v * 100) / total);
  const floors = exact.map(Math.floor);
  let rest = 100 - floors.reduce((a, b) => a + b, 0);
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (rest <= 0) break;
    floors[i] = (floors[i] ?? 0) + 1;
    rest -= 1;
  }
  return floors;
}
