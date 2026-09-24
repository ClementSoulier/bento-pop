'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { SmartImage } from '@/components/SmartImage';
import { formatTimecode } from '@/lib/episodes';
import {
  chapterAt,
  formatSpeed,
  formatSpokenTime,
  nextSpeed,
  parseTimeFragment,
  type PlayerChapter,
} from '@/lib/podcast-player';

type PodcastPlayerProps = {
  src: string;
  title: string;
  /** Durée de la fiche : affichée tant que le navigateur n'a pas lu celle du fichier. */
  durationSeconds: number | null;
  chapters: PlayerChapter[];
  /** Image carrée de l'épisode, reprise aussi sur l'écran verrouillé du téléphone. */
  artworkUrl: string | null;
};

/**
 * Le lecteur des pages podcasts. Il lit notre propre fichier, celui que sert le flux RSS.
 *
 * Il ne dépend plus de Spotify : la page fonctionne dès la sortie de l'épisode, sans attendre
 * que Spotify l'ait repris et qu'on ait recopié son identifiant dans la fiche.
 *
 * Les chapitres de la page restent de simples liens « #t=… » rendus par le serveur. Un clic
 * saute au passage et lance la lecture ; le même lien, partagé, ouvre la page au bon endroit.
 */
export function PodcastPlayer({
  src,
  title,
  durationSeconds,
  chapters,
  artworkUrl,
}: PodcastPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const rootRef = useRef<HTMLElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(durationSeconds ?? 0);
  const [speed, setSpeed] = useState(1);
  const [failed, setFailed] = useState(false);

  const seek = useCallback((t: number, play: boolean) => {
    const audio = audioRef.current;
    if (!audio) return;
    const max = Number.isFinite(audio.duration) ? audio.duration : Number.POSITIVE_INFINITY;
    // Avant que le fichier soit lu, le navigateur garde la position pour le début de la lecture.
    audio.currentTime = Math.min(Math.max(0, t), max);
    setCurrent(audio.currentTime);
    if (play) void audio.play().catch(() => undefined);
  }, []);

  // Arrivée par un lien vers un instant (#t=…), ou changement de cet instant dans l'adresse
  // sans rechargement : on s'y place, sans lancer la lecture.
  useEffect(() => {
    const suivreAdresse = () => {
      const t = parseTimeFragment(window.location.hash);
      if (t != null) seek(t, false);
    };
    suivreAdresse();
    window.addEventListener('hashchange', suivreAdresse);
    return () => window.removeEventListener('hashchange', suivreAdresse);
  }, [seek]);

  // Les liens de chapitres de la page (`data-seek`) pilotent le lecteur.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const lien = (event.target as Element | null)?.closest?.('a[data-seek]');
      const t = Number(lien?.getAttribute('data-seek'));
      if (!lien || !Number.isFinite(t)) return;
      event.preventDefault();
      seek(t, true);
      const calme = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      rootRef.current?.scrollIntoView({ behavior: calme ? 'auto' : 'smooth', block: 'nearest' });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [seek]);

  // Les commandes de l'écran verrouillé et des casques.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const audio = audioRef.current;
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist: 'Bento Pop!',
      artwork: artworkUrl ? [{ src: artworkUrl }] : [],
    });
    const enLecture = () => Boolean(audio && !audio.paused);
    const actions: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ['play', () => void audio?.play().catch(() => undefined)],
      ['pause', () => audio?.pause()],
      ['seekbackward', (d) => seek((audio?.currentTime ?? 0) - (d.seekOffset ?? 15), enLecture())],
      ['seekforward', (d) => seek((audio?.currentTime ?? 0) + (d.seekOffset ?? 30), enLecture())],
      ['seekto', (d) => (d.seekTime != null ? seek(d.seekTime, enLecture()) : undefined)],
    ];
    for (const [action, handler] of actions) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Action inconnue de ce navigateur : les autres restent utilisables.
      }
    }
    return () => {
      for (const [action] of actions) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          // Idem.
        }
      }
    };
  }, [title, artworkUrl, seek]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play().catch(() => undefined);
    else audio.pause();
  };

  const changeSpeed = () => {
    const suivante = nextSpeed(speed);
    if (audioRef.current) audioRef.current.playbackRate = suivante;
    setSpeed(suivante);
  };

  const total = duration || durationSeconds || 0;
  const avance = total ? Math.min(100, (current / total) * 100) : 0;
  const chapitre = chapterAt(chapters, current);

  return (
    <section
      ref={rootRef}
      aria-label="Écouter l’épisode"
      className="scroll-mt-28 rounded-2xl border-[5px] border-bento-ink bg-bento-cream p-4 shadow-[0_8px_0_var(--bento-ink),0_16px_30px_rgba(0,0,0,0.15)] md:p-5"
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setDuration(d);
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => setFailed(true)}
      />

      <div className="flex items-center gap-4">
        {artworkUrl ? (
          <SmartImage
            src={artworkUrl}
            alt=""
            width={96}
            height={96}
            className="hidden h-24 w-24 shrink-0 rounded-xl border-[3px] border-bento-ink object-cover sm:block"
          />
        ) : null}

        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? 'Mettre en pause' : 'Lire l’épisode'}
          className="grid h-16 w-16 shrink-0 place-items-center rounded-full border-[3px] border-bento-ink bg-bento-red text-bento-cream shadow-stamp transition-[transform,box-shadow] duration-100 hover:-translate-y-0.5 hover:shadow-stamp-lg focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-bento-ink active:translate-y-0.5 active:shadow-[0_2px_0_var(--bento-ink)]"
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-[11px] uppercase tracking-[0.15em] text-bento-ink/60">
            {chapitre ? chapitre.label : 'Bento Pop!'}
          </p>
          <p className="line-clamp-2 text-[16px] font-semibold leading-tight text-bento-ink">
            {title}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3 font-mono text-[12px] tabular-nums text-bento-ink/70">
        <span className="min-w-[2.75rem]">{formatTimecode(current)}</span>
        <div className="relative h-5 flex-1">
          {/* Le vrai curseur, invisible mais au-dessus : clavier, souris et lecteurs d'écran. */}
          <input
            type="range"
            min={0}
            max={Math.max(1, Math.round(total))}
            step={1}
            value={Math.min(Math.round(current), Math.max(1, Math.round(total)))}
            onChange={(e) => seek(Number(e.currentTarget.value), playing)}
            aria-label="Position dans l’épisode"
            aria-valuetext={`${formatSpokenTime(current)} sur ${formatSpokenTime(total)}`}
            className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 overflow-hidden rounded-full border-[2px] border-bento-ink bg-bento-tint-base peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-bento-ink"
          >
            <div className="h-full bg-bento-orange" style={{ width: `${avance}%` }} />
          </div>
          {total > 0
            ? chapters
                .filter((c) => c.start_seconds > 0 && c.start_seconds < total)
                .map((c) => (
                  <span
                    key={c.start_seconds}
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 h-3 w-[2px] -translate-y-1/2 bg-bento-ink/35"
                    style={{ left: `${(c.start_seconds / total) * 100}%` }}
                  />
                ))
            : null}
        </div>
        <span className="min-w-[2.75rem] text-right">{formatTimecode(total)}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <SmallButton onClick={() => seek(current - 15, playing)} label="Reculer de 15 secondes">
          −15 s
        </SmallButton>
        <SmallButton onClick={() => seek(current + 30, playing)} label="Avancer de 30 secondes">
          +30 s
        </SmallButton>
        <SmallButton onClick={changeSpeed} label={`Vitesse de lecture : ${formatSpeed(speed)}`}>
          {formatSpeed(speed)}
        </SmallButton>
      </div>

      {failed ? (
        <p role="alert" className="mt-3 text-[14px] text-bento-ink">
          Le fichier audio ne se charge pas. L’épisode reste disponible sur les plateformes
          d’écoute.
        </p>
      ) : null}
    </section>
  );
}

function SmallButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="rounded-full border-[2px] border-bento-ink bg-bento-tint-base px-3 pt-1 pb-0.5 font-mono text-[12px] font-bold text-bento-ink shadow-[0_2px_0_var(--bento-ink)] transition-[transform,box-shadow] duration-100 hover:-translate-y-px hover:shadow-[0_3px_0_var(--bento-ink)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-bento-ink active:translate-y-px active:shadow-none"
    >
      {children}
    </button>
  );
}

function PlayIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="ml-1 h-7 w-7" fill="currentColor">
      <path d="M7 4.5v15a1 1 0 0 0 1.52.85l12.25-7.5a1 1 0 0 0 0-1.7L8.52 3.65A1 1 0 0 0 7 4.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
      <rect x="5.5" y="4" width="4.5" height="16" rx="1.2" />
      <rect x="14" y="4" width="4.5" height="16" rx="1.2" />
    </svg>
  );
}
