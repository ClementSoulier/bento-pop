import type { VoteOption as VoteOptionType } from '@/lib/content/schemas';
import { clsx } from '@/lib/clsx';

type VoteOptionProps = {
  option: VoteOptionType;
  index: number;
  pct: number;
  isMine: boolean;
  hasVoted: boolean;
  disabled: boolean;
  onClick: () => void;
};

export function VoteOption({
  option,
  index,
  pct,
  isMine,
  hasVoted,
  disabled,
  onClick,
}: VoteOptionProps) {
  const letter = String.fromCharCode(65 + index);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        'relative w-full overflow-hidden rounded-[14px] border-[3px] border-bento-ink bg-white px-5 py-3.5 text-left',
        'shadow-stamp transition-[transform,box-shadow] duration-100',
        !hasVoted && 'hover:-translate-y-0.5 hover:shadow-stamp-lg hover:bg-[#fff0c7]',
        'active:translate-y-0.5 active:shadow-[0_2px_0_var(--bento-ink)]',
        hasVoted && !isMine && 'cursor-default',
      )}
      aria-pressed={isMine}
    >
      <span
        aria-hidden
        className={clsx(
          'absolute left-0 top-0 bottom-0 z-0 transition-[width] duration-700 ease-[cubic-bezier(.2,.9,.3,1)]',
          isMine
            ? 'bg-gradient-to-r from-bento-red to-[#b8232f]'
            : 'bg-gradient-to-r from-bento-yellow to-bento-yellow-alt',
        )}
        style={{ width: hasVoted ? `${pct}%` : '0%' }}
      />
      <span className="relative z-[1] flex items-center justify-between gap-4">
        <span className="flex flex-1 items-center gap-3 text-[16px] font-semibold leading-[1.3]">
          <span
            className={clsx(
              'grid h-8 w-8 flex-shrink-0 place-items-center rounded-full text-[14px] font-bold text-bento-cream',
              isMine ? 'bg-bento-red' : 'bg-bento-ink',
            )}
          >
            {letter}
          </span>
          {option.label}
        </span>
        {hasVoted ? (
          <span className="font-display min-w-[60px] text-right text-[22px] text-bento-ink">
            {pct.toFixed(0)}%
          </span>
        ) : (
          <span className="font-display min-w-[60px] text-right text-[14px] text-bento-ink/30">
            VOTER
          </span>
        )}
      </span>
    </button>
  );
}
