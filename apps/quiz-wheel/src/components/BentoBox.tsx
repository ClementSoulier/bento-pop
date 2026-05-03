'use client';

import { Compartment } from './Compartment';
import type { Layout } from '@/data/layouts';
import { POPYS } from '@/data/popys';

type Props = {
  layout: Layout;
  highlighted: number;
  winner: number;
  showLabels: boolean;
};

export function BentoBox({ layout, highlighted, winner, showLabels }: Props) {
  return (
    <div className="fixed inset-0 z-[5] grid place-items-center px-10 pb-44 pt-32">
      <div
        className="
          relative aspect-[1.35/1] w-[min(860px,84vw)]
          rounded-bento border-[6px] border-bento-ink bg-bento-cream p-[18px]
          shadow-[0_10px_0_var(--bento-ink),0_20px_40px_rgba(0,0,0,0.25)]
          before:absolute before:left-[26px] before:top-2 before:h-2.5 before:w-2.5 before:rounded-full before:bg-bento-ink
          before:shadow-[18px_4px_0_0_var(--bento-ink),38px_-2px_0_-1px_var(--bento-ink),60px_2px_0_0_var(--bento-ink),-14px_18px_0_-2px_var(--bento-ink)]
          after:absolute after:bottom-2 after:right-[26px] after:h-2.5 after:w-2.5 after:rounded-full after:bg-bento-ink
          after:shadow-[-18px_4px_0_0_var(--bento-ink),-38px_-2px_0_-1px_var(--bento-ink),-60px_2px_0_0_var(--bento-ink),14px_18px_0_-2px_var(--bento-ink)]
        "
      >
        <div className={`bento-grid ${layout.className}`}>
          {layout.dishes.map((key, i) => (
            <Compartment
              key={`${layout.key}-${i}-${key}`}
              popy={POPYS[key]}
              isLit={highlighted === i && winner < 0}
              isWinner={winner === i}
              showLabel={showLabels}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
