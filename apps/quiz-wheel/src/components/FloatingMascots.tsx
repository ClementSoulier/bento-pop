'use client';

import Image from 'next/image';
import type { CSSProperties } from 'react';
import popyFille from '@bento-pop/brand/assets/mascot/popy-fille.png';
import popyGene from '@bento-pop/brand/assets/mascot/popy-gene.png';
import popyNani from '@bento-pop/brand/assets/mascot/popy-nani.png';
import popyIntello from '@bento-pop/brand/assets/mascot/popy-intello.png';

type Mascot = {
  src: typeof popyFille;
  alt: string;
  style: CSSProperties & { '--r'?: string };
};

const MASCOTS: Mascot[] = [
  {
    src: popyFille,
    alt: '',
    style: { top: '55%', left: '1.5%', width: 90, height: 90, animationDelay: '-0.5s', '--r': '-10deg' },
  },
  {
    src: popyGene,
    alt: '',
    style: { bottom: '3%', left: '5%', width: 80, height: 80, animationDelay: '-2s', '--r': '6deg' },
  },
  {
    src: popyNani,
    alt: '',
    style: { top: '62%', right: '1.5%', width: 95, height: 95, animationDelay: '-1.2s', '--r': '8deg' },
  },
  {
    src: popyIntello,
    alt: '',
    style: { bottom: '5%', right: '4%', width: 85, height: 85, animationDelay: '-2.8s', '--r': '-8deg' },
  },
];

export function FloatingMascots() {
  return (
    <>
      {MASCOTS.map((m, i) => (
        <div
          key={i}
          className="pointer-events-none fixed z-[2] [animation:bob_4s_ease-in-out_infinite] drop-shadow-[0_6px_0_rgba(0,0,0,0.15)]"
          style={m.style as CSSProperties}
        >
          <Image src={m.src} alt={m.alt} fill className="object-contain" sizes="100px" />
        </div>
      ))}
    </>
  );
}
