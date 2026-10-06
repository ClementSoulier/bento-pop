'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SmartImage } from '@/components/SmartImage';
import { Sticker } from '@/components/Sticker';
import { YoutubeIcon } from '@/components/icons';
import { clsx } from '@/lib/clsx';
import type { GuestShort } from '@/lib/shorts/feed';

/** Date déjà formatée côté serveur : pas d'écart de fuseau à l'hydratation. */
export type SliderShort = GuestShort & { dateLabel: string };

type InvitesSliderProps = {
  shorts: SliderShort[];
  playlistUrl: string;
};

/** Micro-rotations « collé à la main », en boucle sur les cartes. */
const ROTATIONS = [-2, 1.5, -1, 2, -1.5, 1];

/** Écart entre deux cartes, en px : sert au pas des flèches. */
const GAP = 28;

/**
 * Marge latérale de la piste : alignée sur le conteneur de 1320 px (moins
 * ses 28 px de gouttière) sur grand écran, 28 px en dessous.
 */
const EDGE = 'max(28px, calc((100vw - 1264px) / 2))';

export function InvitesSlider({ shorts, playlistUrl }: InvitesSliderProps) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const syncEdges = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft < 8);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    syncEdges();
    window.addEventListener('resize', syncEdges);
    return () => window.removeEventListener('resize', syncEdges);
  }, [syncEdges]);

  /** Avance d'une « page » de cartes, moins une pour garder un repère. */
  const scrollByPage = (dir: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector('li');
    const step = card ? card.offsetWidth + GAP : 300;
    const perPage = Math.max(1, Math.floor(el.clientWidth / step) - 1);
    el.scrollBy({ left: dir * step * perPage, behavior: 'smooth' });
  };

  return (
    <>
      <ul
        ref={trackRef}
        onScroll={syncEdges}
        aria-label="Shorts des invités"
        className="relative flex snap-x snap-mandatory overflow-x-auto pt-6 pb-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ gap: GAP, paddingInline: EDGE, scrollPaddingInline: EDGE }}
      >
        {shorts.map((short, i) => {
          const isPlaying = playing === short.youtubeId;
          return (
            <li
              key={short.youtubeId}
              className="relative w-[clamp(220px,24vw,272px)] shrink-0 snap-start rounded-[26px] border-[5px] border-bento-ink bg-bento-cream p-2 shadow-[0_8px_0_var(--bento-yellow)]"
              style={{ transform: `rotate(${ROTATIONS[i % ROTATIONS.length] ?? 0}deg)` }}
            >
              <Sticker rotation={-6} className="-top-4 left-[18px] text-[15px]">
                #{String(i + 1).padStart(2, '0')}
              </Sticker>
              <div className="relative aspect-[9/16] overflow-hidden rounded-[18px] border-[4px] border-bento-ink bg-bento-ink">
                {isPlaying ? (
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${short.youtubeId}?autoplay=1&rel=0&playsinline=1&modestbranding=1`}
                    title={short.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                    className="absolute inset-0 h-full w-full border-0"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setPlaying(short.youtubeId)}
                    aria-label={`Lire le short de ${short.guest}`}
                    className="group absolute inset-0 block h-full w-full"
                  >
                    <SmartImage
                      src={`https://i.ytimg.com/vi/${short.youtubeId}/oar2.jpg`}
                      alt=""
                      fill
                      sizes="272px"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <span className="absolute inset-0 bg-black/10" />
                    <span className="absolute left-1/2 top-1/2 grid h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[5px] border-bento-ink bg-bento-cream shadow-[0_6px_0_var(--bento-ink)] transition-[transform,box-shadow] duration-150 group-hover:-translate-y-[54%] group-hover:shadow-[0_10px_0_var(--bento-ink)]">
                      <span
                        aria-hidden
                        className="ml-1.5 h-0 w-0"
                        style={{
                          borderLeft: '22px solid var(--bento-ink)',
                          borderTop: '14px solid transparent',
                          borderBottom: '14px solid transparent',
                        }}
                      />
                    </span>
                    <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-bento-ink px-2.5 pt-[5px] pb-[3px] text-[11px] font-bold uppercase tracking-[0.15em] text-bento-cream">
                      <YoutubeIcon width={13} height={13} />
                      Short
                    </span>
                  </button>
                )}
              </div>
              <div className="px-1.5 pt-3 pb-1.5">
                <h3 className="text-[18px] font-bold uppercase leading-[1.1] tracking-[0.02em] text-bento-ink">
                  {short.guest}
                </h3>
                {short.dateLabel ? (
                  <p className="mt-1 text-[13px] font-semibold text-bento-ink/70">
                    {short.dateLabel}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="relative mx-auto mt-2 flex max-w-[1320px] flex-wrap items-center justify-between gap-5 px-7">
        <div className="flex gap-3">
          <ArrowButton dir={-1} disabled={atStart} onClick={() => scrollByPage(-1)} />
          <ArrowButton dir={1} disabled={atEnd} onClick={() => scrollByPage(1)} />
        </div>
        <a
          href={playlistUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2.5 rounded-full border-[3px] border-bento-ink bg-bento-red px-4 pt-2 pb-1.5 text-[13px] font-bold uppercase tracking-[0.1em] text-bento-cream shadow-[0_4px_0_var(--bento-yellow)] transition-[transform,box-shadow] duration-100 ease-out hover:-translate-y-0.5 hover:shadow-[0_8px_0_var(--bento-yellow)]"
        >
          <YoutubeIcon width={18} height={18} />
          <span>Tous les shorts</span>
        </a>
      </div>
    </>
  );
}

function ArrowButton({
  dir,
  disabled,
  onClick,
}: {
  dir: -1 | 1;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir < 0 ? 'Shorts précédents' : 'Shorts suivants'}
      className={clsx(
        'inline-flex h-[52px] w-[52px] items-center justify-center rounded-full',
        'border-[3px] border-bento-ink bg-bento-cream text-bento-ink',
        'shadow-[0_4px_0_var(--bento-yellow)] transition-[transform,box-shadow,opacity] duration-100',
        'enabled:hover:-translate-y-0.5 enabled:hover:shadow-[0_8px_0_var(--bento-yellow)]',
        'enabled:active:translate-y-0.5 enabled:active:shadow-[0_2px_0_var(--bento-yellow)]',
        'disabled:cursor-default disabled:opacity-40',
      )}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d={dir < 0 ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
          stroke="currentColor"
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
