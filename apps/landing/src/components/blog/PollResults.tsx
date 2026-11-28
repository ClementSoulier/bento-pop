import { clsx } from '@/lib/clsx';
import { formatPublishedDate } from '@/lib/episodes';
import { pollPercentages, type PollBlock } from '@/lib/blog/poll';

/**
 * Résultats figés d'un sondage du Thermomètre, dans un article. Même vocabulaire
 * visuel que la section Thermomètre de la home (barres jaunes, gagnant en rouge),
 * sans bouton : on ne vote plus ici.
 */
export function PollResults({ poll }: { poll: PollBlock }) {
  const pcts = pollPercentages(poll.options.map((o) => o.votes));
  const best = Math.max(...poll.options.map((o) => o.votes));
  const date = formatPublishedDate(poll.closedAt);
  return (
    <figure className="my-10 rounded-[22px] border-[4px] border-bento-ink bg-bento-cream p-5 shadow-stamp md:p-7">
      <figcaption>
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-bento-ink/65">
          Le Thermomètre{poll.weekTag ? ` · ${poll.weekTag}` : ''}
        </div>
        <p className="font-display-sm mt-2 text-[22px] leading-[1.2] text-bento-ink">{poll.question}</p>
      </figcaption>
      <ol className="mt-5 space-y-2.5">
        {poll.options.map((o, i) => {
          const winner = poll.total > 0 && o.votes === best;
          const pct = pcts[i] ?? 0;
          return (
            <li
              key={i}
              className="relative overflow-hidden rounded-[14px] border-[3px] border-bento-ink bg-white px-4 py-3"
            >
              <span
                aria-hidden
                className={clsx(
                  'absolute inset-y-0 left-0',
                  winner
                    ? 'bg-gradient-to-r from-bento-red to-[#b8232f]'
                    : 'bg-gradient-to-r from-bento-yellow to-bento-yellow-alt',
                )}
                style={{ width: `${pct}%` }}
              />
              <span className="relative flex items-center justify-between gap-4">
                <span className="flex items-center gap-3 text-[16px] font-semibold leading-[1.3]">
                  <span
                    aria-hidden
                    className={clsx(
                      'grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-bold text-bento-cream',
                      winner ? 'bg-bento-red' : 'bg-bento-ink',
                    )}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span>
                    {o.label}
                    <span className="sr-only">
                      {` : ${pct} %, ${o.votes} vote${o.votes > 1 ? 's' : ''}${winner ? ', en tête' : ''}`}
                    </span>
                  </span>
                </span>
                <span aria-hidden className="font-display-sm min-w-[56px] text-right text-[20px] text-bento-ink">
                  {pct}%
                </span>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.15em] text-bento-ink/65">
        {poll.total.toLocaleString('fr-FR')} vote{poll.total > 1 ? 's' : ''}
        {date ? ` · résultats arrêtés le ${date}` : ''}
      </p>
    </figure>
  );
}
