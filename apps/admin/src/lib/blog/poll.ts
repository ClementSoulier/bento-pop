/**
 * Résultats d'un sondage du Thermomètre figés dans un article (docs/BLOG.md D15 à D19).
 *
 * L'instantané est copié dans le document de l'article, en attributs du bloc `poll` :
 * il ne bouge plus ensuite, même si des votes arrivent encore ou si le sondage est
 * supprimé (la suppression efface ses votes en cascade).
 */
// Import relatif : le lanceur de tests (tsx) ne résout pas l'alias `@/`.
import { slugify } from '../slugify';
import type { BlogDoc } from './document';

export type PollSnapshotOption = { label: string; votes: number };

export type PollSnapshot = {
  weekId: string;
  weekTag: string;
  question: string;
  options: PollSnapshotOption[];
  total: number;
  /** ISO : date à laquelle les chiffres ont été arrêtés. */
  closedAt: string;
};

export type PollWeek = {
  id: string;
  week_tag: string;
  question: string;
  options: Array<{ id: string; label: string }> | null;
};

export type PollResultRow = { option_id: string; votes: number | null };

export function buildPollSnapshot(
  week: PollWeek,
  results: PollResultRow[],
  closedAt: string,
): PollSnapshot {
  const votesByOption = new Map<string, number>();
  for (const r of results) {
    votesByOption.set(r.option_id, (votesByOption.get(r.option_id) ?? 0) + Math.max(0, r.votes ?? 0));
  }
  // Les options suivent l'ordre du sondage ; un vote pour une option retirée depuis
  // n'est plus attribuable, il ne compte pas.
  const options = (week.options ?? []).map((o) => ({ label: o.label, votes: votesByOption.get(o.id) ?? 0 }));
  return {
    weekId: week.id,
    weekTag: week.week_tag,
    question: week.question,
    options,
    total: options.reduce((sum, o) => sum + o.votes, 0),
    closedAt,
  };
}

/**
 * Pourcentages entiers qui totalisent toujours 100 (méthode du plus fort reste) :
 * 33/33/33 deviendrait 99 %, ce qui se remarque.
 */
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

const plural = (n: number, one: string, many: string) => `${n.toLocaleString('fr-FR')} ${n > 1 ? many : one}`;

/** Chapô de l'article : participation et option gagnante, égalité comprise. */
export function resultsExcerpt(snapshot: PollSnapshot): string {
  const pcts = pollPercentages(snapshot.options.map((o) => o.votes));
  const best = Math.max(...snapshot.options.map((o) => o.votes));
  const leaders = snapshot.options.filter((o) => o.votes === best);
  const leaderPct = pcts[snapshot.options.findIndex((o) => o.votes === best)] ?? 0;
  const head = `Vous avez été ${plural(snapshot.total, 'personne', 'personnes')} à répondre.`;
  if (leaders.length === 1) {
    return `${head} « ${leaders[0]?.label} » l’emporte avec ${leaderPct} % des votes.`;
  }
  const names = leaders.map((o) => `« ${o.label} »`);
  const last = names.pop();
  return `${head} Égalité en tête entre ${names.join(', ')} et ${last}, à ${leaderPct} % chacun.`;
}

export const THERMOMETRE_CATEGORY = {
  slug: 'thermometre',
  name: 'Le Thermomètre',
  description:
    'Les résultats des sondages du Thermomètre Pop Culture, la question posée chaque semaine sur bento-pop.com.',
} as const;

export function resultsTitle(snapshot: PollSnapshot): string {
  return `Résultats du Thermomètre : ${snapshot.question}`.slice(0, 200);
}

export function resultsSlugBase(snapshot: PollSnapshot): string {
  const tail = slugify(snapshot.question).slice(0, 90).replace(/-+$/, '');
  return tail ? `thermometre-${tail}` : 'thermometre-resultats';
}

/** Premier slug libre : la base, puis base-2, base-3… */
export function firstFreeSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`;
    if (!used.has(candidate)) return candidate;
  }
}

/** Attributs du bloc `poll`, tels que l'éditeur et la landing les lisent. */
export function pollNodeAttrs(snapshot: PollSnapshot): Record<string, unknown> {
  return {
    weekId: snapshot.weekId,
    weekTag: snapshot.weekTag,
    question: snapshot.question,
    options: snapshot.options.map((o) => ({ label: o.label, votes: o.votes })),
    total: snapshot.total,
    closedAt: snapshot.closedAt,
  };
}

/** Document de l'article publié à la clôture d'un sondage. */
export function resultsDocument(snapshot: PollSnapshot): BlogDoc {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Le sondage du Thermomètre est clos. Voici vos réponses.' }],
      },
      { type: 'poll', attrs: pollNodeAttrs(snapshot) },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'La nouvelle question vous attend déjà ' },
          {
            type: 'text',
            text: 'sur la page d’accueil',
            marks: [{ type: 'link', attrs: { href: '/#thermometre' } }],
          },
          { type: 'text', text: '.' },
        ],
      },
    ],
  };
}
