import type { EpisodeMention } from '@/content/episodes';
import { MENTION_TYPE_LABELS } from '@/lib/episodes';

type MentionsListProps = { mentions: EpisodeMention[] };

export function MentionsList({ mentions }: MentionsListProps) {
  return (
    <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {mentions.map((m, i) => (
        <li key={i}>
          <MentionItem mention={m} />
        </li>
      ))}
    </ul>
  );
}

function MentionItem({ mention: m }: { mention: EpisodeMention }) {
  const content = (
    <>
      <MentionCover coverUrl={m.cover_url} title={m.title} />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
        <span className="self-start rounded-full border-[2px] border-bento-ink bg-bento-cream px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-bento-ink/70">
          {MENTION_TYPE_LABELS[m.type] ?? m.type}
        </span>
        <span className="line-clamp-2 text-[14px] font-semibold leading-snug">{m.title}</span>
      </div>
    </>
  );

  const baseClasses =
    'group flex gap-3 rounded-xl border-[2px] border-bento-ink/15 bg-bento-cream/60 p-2';

  if (m.url) {
    return (
      <a
        href={m.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`${baseClasses} transition-[transform,border-color,background-color] hover:-translate-y-0.5 hover:border-bento-ink hover:bg-bento-cream`}
      >
        {content}
      </a>
    );
  }

  return <div className={baseClasses}>{content}</div>;
}

function MentionCover({ coverUrl, title }: { coverUrl: string | undefined; title: string }) {
  return (
    <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg border-[2px] border-bento-ink bg-bento-yellow">
      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl}
          alt={title}
          loading="lazy"
          className="h-full w-full object-contain p-1"
        />
      ) : (
        <span aria-hidden="true" className="font-display text-[26px] leading-none text-bento-ink/40">
          {title.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}
