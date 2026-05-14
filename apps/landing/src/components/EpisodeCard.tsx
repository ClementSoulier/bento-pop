import Link from 'next/link';
import { clsx } from '@/lib/clsx';
import { HostAvatar } from '@/components/HostAvatar';
import {
  formatDurationShort,
  formatPublishedDate,
  youtubeThumbnail,
} from '@/lib/episodes';
import type { EpisodeHost } from '@/content/episodes';

type EpisodeCardProps = {
  href: string;
  title: string;
  season: number;
  episodeNumber: number | null;
  /* URL miniature override ; sinon on génère depuis youtubeId (show) ou
     thumbnailUrl est null pour podcast → fond plein. */
  thumbnailUrl: string | null;
  youtubeId?: string;
  durationSeconds: number | null;
  publishedAt: string | null;
  hosts: EpisodeHost[];
  kind: 'show' | 'podcast';
};

export function EpisodeCard({
  href,
  title,
  season,
  episodeNumber,
  thumbnailUrl,
  youtubeId,
  durationSeconds,
  publishedAt,
  hosts,
  kind,
}: EpisodeCardProps) {
  const thumb = thumbnailUrl ?? (youtubeId ? youtubeThumbnail(youtubeId, 'hq') : null);
  const duration = formatDurationShort(durationSeconds);
  const date = formatPublishedDate(publishedAt);
  return (
    <Link
      href={href}
      className={clsx(
        'group flex flex-col overflow-hidden rounded-[22px]',
        'border-[4px] border-bento-ink bg-bento-cream',
        'shadow-stamp transition-[transform,box-shadow] duration-150',
        'hover:-translate-y-1 hover:shadow-stamp-lg',
        'active:translate-y-0.5 active:shadow-[0_3px_0_var(--bento-ink)]',
      )}
    >
      <div
        className={clsx(
          'relative aspect-video w-full overflow-hidden border-b-[4px] border-bento-ink',
          kind === 'show' ? 'bg-bento-ink' : 'bg-[#1ed760]',
        )}
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-display text-bento-cream text-[64px]">
            {kind === 'show' ? '▶' : '🎙'}
          </div>
        )}
        <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border-[2px] border-bento-ink bg-bento-yellow px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-bento-ink">
          S{season}
          {episodeNumber != null ? ` · E${episodeNumber}` : ''}
        </div>
        {duration ? (
          <div className="absolute bottom-3 right-3 rounded-md border-[2px] border-bento-ink bg-bento-ink px-2 py-0.5 font-mono text-[11px] font-bold text-bento-cream">
            {duration}
          </div>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="font-display text-[18px] leading-[1.15] text-bento-ink line-clamp-3">
          {title}
        </h3>
        <div className="mt-auto flex items-center justify-between gap-2">
          {date ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-bento-ink/60">
              {date}
            </span>
          ) : (
            <span />
          )}
          {hosts.length > 0 ? (
            <div className="flex -space-x-1.5">
              {hosts.slice(0, 4).map((h) => (
                <HostAvatar key={h.id} photo={h.photo} name={h.name} size="xs" />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
