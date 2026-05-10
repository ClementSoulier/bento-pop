import { clsx } from '@/lib/clsx';

type LiveBadgeProps = {
  children?: React.ReactNode;
  className?: string;
};

/**
 * Badge "LIVE" : pastille rouge qui pulse + texte uppercase.
 */
export function LiveBadge({ children = 'Live', className }: LiveBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5',
        'border-2 border-bento-ink rounded',
        'bg-white text-bento-ink',
        'px-2 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-[0.15em]',
        className,
      )}
    >
      <span
        aria-hidden
        className="h-[7px] w-[7px] rounded-full bg-bento-red"
        style={{ animation: 'bp-live-pulse 1.2s infinite' }}
      />
      {children}
    </span>
  );
}
