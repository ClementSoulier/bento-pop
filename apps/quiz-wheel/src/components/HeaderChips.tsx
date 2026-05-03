'use client';

import Image from 'next/image';
import logo from '@bento-pop/brand/assets/logo/bento-pop.png';

type Props = {
  round: number;
  status: 'idle' | 'spinning' | 'revealed';
};

const STATUS_LABEL: Record<Props['status'], string> = {
  idle: 'Prêt',
  spinning: 'Tirage…',
  revealed: 'Tiré !',
};

const DOT_COLOR: Record<Props['status'], string> = {
  idle: 'bg-[#4ade80]',
  spinning: 'bg-bento-yellow animate-pulse-dot',
  revealed: 'bg-[#ef4444]',
};

export function HeaderChips({ round, status }: Props) {
  return (
    <>
      <div className="fixed left-6 top-[22px] z-20 w-[180px]">
        <Image
          src={logo}
          alt="Bento Pop"
          priority
          className="h-auto w-full drop-shadow-[0_3px_0_rgba(0,0,0,0.2)]"
        />
      </div>
      <div className="fixed right-7 top-[30px] z-20 flex items-center gap-2.5">
        <Chip>
          Manche · <span className="ml-1 tabular-nums">{String(round).padStart(2, '0')}</span>
        </Chip>
        <Chip>
          <span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full border-2 border-bento-ink ${DOT_COLOR[status]}`} />
          {STATUS_LABEL[status]}
        </Chip>
      </div>
    </>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="
        inline-flex items-center gap-2 rounded-full border-[3px] border-bento-ink bg-bento-cream
        px-4 pb-1.5 pt-2 font-body text-[13px] font-bold uppercase tracking-[0.05em]
        shadow-stamp
      "
    >
      {children}
    </span>
  );
}
