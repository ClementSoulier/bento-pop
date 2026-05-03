'use client';

import Image from 'next/image';
import type { Popy } from '@/data/popys';

type Props = {
  popy: Popy;
  isLit: boolean;
  isWinner: boolean;
  showLabel: boolean;
};

export function Compartment({ popy, isLit, isWinner, showLabel }: Props) {
  const cls = ['compartment', popy.tint];
  if (isLit) cls.push('lit');
  if (isWinner) cls.push('winner');

  return (
    <div className={cls.join(' ')}>
      <Image
        className="popy-img"
        src={popy.img}
        alt={popy.name}
        priority
        sizes="(max-width: 1024px) 30vw, 240px"
      />
      <span className="spark s1" />
      <span className="spark s2" />
      <span className="spark s3" />
      {showLabel && isWinner && (
        <span
          className="absolute -bottom-3 left-3.5 rounded-full border-2 border-bento-ink bg-bento-ink px-2.5 pb-[3px] pt-1 font-body text-[11px] font-bold uppercase tracking-[0.1em] text-bento-cream shadow-[0_2px_0_rgba(0,0,0,0.4)]"
        >
          {popy.name.replace('Popy ', '')}
        </span>
      )}
    </div>
  );
}
