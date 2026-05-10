import type { CSSProperties } from 'react';
import { clsx } from '@/lib/clsx';

type StickerProps = {
  children: React.ReactNode;
  rotation?: number;
  tone?: 'red' | 'cream';
  className?: string;
  style?: CSSProperties;
};

/**
 * Sticker rouge (ou crème) tourné, façon « collé à la main ».
 * Utilisé en accents autour des grosses surfaces (hero bento, …).
 */
export function Sticker({
  children,
  rotation = 0,
  tone = 'red',
  className,
  style,
}: StickerProps) {
  const toneClasses =
    tone === 'red'
      ? 'bg-bento-red text-bento-cream'
      : 'bg-bento-cream text-bento-ink';
  return (
    <span
      className={clsx(
        'absolute z-[5] inline-block',
        'border-[3px] border-bento-ink rounded-[14px] shadow-stamp',
        'font-display text-[16px] leading-none uppercase',
        'px-3.5 pt-2.5 pb-2',
        toneClasses,
        className,
      )}
      style={{ transform: `rotate(${rotation}deg)`, ...style }}
    >
      {children}
    </span>
  );
}
