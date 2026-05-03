'use client';

import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import type { Popy } from '@/data/popys';

type Props = {
  popy: Popy | null;
  open: boolean;
  onClose: () => void;
};

export function RevealModal({ popy, open, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && popy && (
        <motion.div
          className="fixed inset-0 z-30 grid place-items-center bg-black/55 p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          onClick={(e) => {
            if (e.currentTarget === e.target) onClose();
          }}
        >
          <motion.div
            className="
              relative w-[min(520px,92vw)] rounded-[30px] border-[6px] border-bento-ink bg-bento-cream
              px-10 pb-9 pt-9 text-center shadow-reveal
            "
            initial={{ scale: 0.7, rotate: -4 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0.85, rotate: 2, opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.2, 1.8, 0.4, 1] }}
          >
            <div
              className="
                mx-auto -mt-[90px] mb-2 h-[140px] w-[140px]
                drop-shadow-[0_4px_0_var(--bento-ink)] [animation:popyBoing_0.7s_var(--bento-ease-pop)]
              "
            >
              <Image src={popy.img} alt={popy.name} width={140} height={140} className="h-full w-full object-contain" />
            </div>
            <div className="mb-1 font-body text-[11px] font-bold uppercase tracking-[0.3em] text-bento-red">
              Popy choisi
            </div>
            <div className="mb-5 font-display text-[38px] leading-none tracking-[0.03em] text-bento-ink">
              {popy.name.toUpperCase()}
            </div>

            <div className="mb-4 flex items-center justify-center gap-2.5">
              <span className="h-[3px] max-w-[60px] flex-1 rounded bg-bento-ink" />
              <span className="font-body text-[11px] font-bold uppercase tracking-[0.25em]">Le Jeu</span>
              <span className="h-[3px] max-w-[60px] flex-1 rounded bg-bento-ink" />
            </div>

            <div
              className="
                rounded-[16px] border-4 border-bento-ink bg-bento-yellow px-5 pb-4 pt-4.5
                shadow-stamp
              "
            >
              <div className="mb-1.5 font-display text-[22px] leading-tight text-bento-ink">
                {popy.game.name.toUpperCase()}
              </div>
              <div className="font-body text-sm font-medium leading-snug text-bento-ink">
                {popy.game.desc}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
