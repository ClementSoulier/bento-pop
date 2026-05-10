import type { CSSProperties, ReactNode } from 'react';
import { clsx } from '@/lib/clsx';

type BentoFrameProps = {
  children: ReactNode;
  rotation?: number;
  className?: string;
  style?: CSSProperties;
  /** Affiche les rivets noirs façon « baguettes » dans les coins. */
  rivets?: boolean;
};

/**
 * Boîte « bento » : fond crème, contour ink épais, ombre stamp + diffuse,
 * radius généreux et option rivets noirs pour rappeler les baguettes.
 * Utilisé pour le showcase Hero et le bento des Univers.
 */
export function BentoFrame({
  children,
  rotation = 0,
  className,
  style,
  rivets = true,
}: BentoFrameProps) {
  return (
    <div
      className={clsx(
        'relative bg-bento-cream',
        'border-[6px] border-bento-ink rounded-[32px]',
        'p-4',
        'shadow-[0_10px_0_var(--bento-ink),0_20px_40px_rgba(0,0,0,0.2)]',
        rivets && 'bento-frame--rivets',
        className,
      )}
      style={{ transform: rotation ? `rotate(${rotation}deg)` : undefined, ...style }}
    >
      {children}
      {rivets ? (
        <>
          <span aria-hidden className="bento-rivet-top" />
          <span aria-hidden className="bento-rivet-bottom" />
        </>
      ) : null}
    </div>
  );
}
