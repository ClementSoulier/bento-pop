import type { AgendaEvent } from '@/lib/content/schemas';
import { PinIcon } from '@/components/icons';
import { formatAgendaDate } from '@/lib/format/date';
import { clsx } from '@/lib/clsx';

type AgendaRowProps = { event: AgendaEvent };

const STATUS_CLASSES: Record<AgendaEvent['status'], string> = {
  live: 'bg-bento-red text-bento-cream',
  soon: 'bg-bento-cream text-bento-ink',
  done: 'bg-bento-ink/5 text-bento-ink',
};

export function AgendaRow({ event }: AgendaRowProps) {
  const { day, month, year } = formatAgendaDate(event.date);
  const isPast = event.status === 'done';
  const isLive = event.status === 'live';
  // Mois rouge sur fond blanc : ~3.7:1, FAIL pour texte normal. Sur fond
  // jaune (cas isLive) : ~2.3:1, encore moins. On bascule en ink → toujours
  // au-dessus de 12:1, et la barre rouge décorative n'est pas perdue car
  // c'est la pastille de status qui porte l'accent rouge.
  return (
    <article
      className={clsx(
        'grid items-center gap-6',
        'border-[3px] border-bento-ink rounded-[18px] bg-white px-6 py-4',
        'shadow-stamp-lg transition-[transform,box-shadow] duration-150',
        'hover:-translate-y-0.5 hover:shadow-[0_7px_0_var(--bento-ink)]',
        'grid-cols-[90px_1fr] md:grid-cols-[130px_1fr_auto_auto]',
        isLive && 'bg-bento-yellow',
        isPast && 'opacity-55',
      )}
    >
      <time
        dateTime={event.date}
        className="block border-r-[3px] border-dashed border-bento-ink pr-4 text-center md:pr-5"
        aria-label={`${day} ${month} ${year}`}
      >
        <span className="font-display block text-[36px] leading-none">{day}</span>
        <span className="mt-1 block text-[11px] font-bold uppercase tracking-[0.2em] text-bento-ink">
          {month}
        </span>
        <span className="mt-0.5 block text-[10px] font-medium opacity-60">{year}</span>
      </time>
      <div>
        <h3 className="font-display text-[24px] leading-none mb-1.5">{event.title}</h3>
        <div className="flex items-center gap-1.5 text-[13px] font-semibold text-bento-ink/70">
          <PinIcon width={14} height={14} aria-hidden />
          {event.place}
        </div>
      </div>
      <div className="rounded-md bg-bento-ink px-3 pt-1.5 pb-1 text-[11px] font-bold uppercase tracking-[0.15em] text-bento-cream md:justify-self-start col-span-2 justify-self-start md:col-span-1">
        {event.stand}
      </div>
      <div
        className={clsx(
          'rounded-full border-2 border-bento-ink px-3 pt-1.5 pb-1 text-[11px] font-bold uppercase tracking-[0.15em]',
          STATUS_CLASSES[event.status],
          'col-span-2 justify-self-start md:col-span-1 md:justify-self-end',
        )}
      >
        {event.statusLabel}
      </div>
    </article>
  );
}
