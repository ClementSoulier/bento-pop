import type { HeroBentoCell as HeroBentoCellType } from '@/lib/content/schemas';
import { LiveBadge } from '@/components/LiveBadge';
import { clsx } from '@/lib/clsx';

type HeroBentoCellProps = { cell: HeroBentoCellType };

const TONE_BG: Record<'jx' | 'pm' | 'dh' | 'cnv', string> = {
  jx: 'bg-[#ffe5a8]',
  pm: 'bg-[#fff0c7]',
  dh: 'bg-gradient-to-br from-[#2a3142] to-[#1a1f2e] text-white',
  cnv: 'bg-[#ffecc2]',
};

const cellBase =
  'relative overflow-hidden border-[4px] border-bento-ink rounded-[18px] shadow-[0_3px_0_var(--bento-ink)]';

export function HeroBentoCell({ cell }: HeroBentoCellProps) {
  if (cell.kind === 'video') {
    if (cell.youtubeId) {
      return (
        <div
          className={clsx(cellBase, 'aspect-video bg-bento-ink')}
          style={{ gridArea: cell.gridArea }}
        >
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${cell.youtubeId}?rel=0&modestbranding=1`}
            title={cell.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            loading="lazy"
            className="absolute inset-0 h-full w-full border-0"
          />
          {cell.live ? (
            <LiveBadge className="pointer-events-none absolute right-3.5 top-3.5 z-10">
              Live
            </LiveBadge>
          ) : null}
          <span className="pointer-events-none absolute bottom-3.5 left-3.5 z-10 inline-block rounded-full bg-bento-ink px-2.5 pt-1 pb-0.5 text-[11px] font-bold uppercase tracking-[0.15em] text-bento-cream">
            {cell.episodeLabel}
          </span>
        </div>
      );
    }
    return (
      <a
        href={cell.href}
        target="_blank"
        rel="noopener noreferrer"
        className={clsx(
          cellBase,
          'group cursor-pointer transition-transform duration-200 hover:scale-[1.02] hover:-rotate-1',
          'bg-gradient-to-br from-[#ff6b6b] to-[#c41e3a]',
        )}
        style={{ gridArea: cell.gridArea }}
      >
        <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(255,255,255,0.3),transparent_60%)]" />
        {cell.live ? (
          <LiveBadge className="absolute right-3.5 top-3.5">Live</LiveBadge>
        ) : null}
        <div
          className="absolute left-3.5 right-3.5 top-3.5 text-bento-cream font-bold text-[14px] leading-[1.2]"
          style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
        >
          {cell.title}
        </div>
        <span
          className={clsx(
            'absolute left-1/2 top-1/2 grid h-20 w-20 -translate-x-1/2 -translate-y-1/2 place-items-center',
            'rounded-full border-[5px] border-bento-ink bg-bento-cream',
            'shadow-[0_6px_0_var(--bento-ink)] transition-[transform,box-shadow] duration-150',
            'group-hover:translate-y-[-54%] group-hover:shadow-[0_10px_0_var(--bento-ink)]',
          )}
        >
          <span
            aria-hidden
            className="ml-1.5 h-0 w-0"
            style={{
              borderLeft: '24px solid var(--bento-ink)',
              borderTop: '16px solid transparent',
              borderBottom: '16px solid transparent',
            }}
          />
        </span>
        <span className="absolute bottom-3.5 left-3.5 inline-block rounded-full bg-bento-ink px-2.5 pt-1 pb-0.5 text-[11px] font-bold uppercase tracking-[0.15em] text-bento-cream">
          {cell.episodeLabel}
        </span>
      </a>
    );
  }

  if (cell.kind === 'popy') {
    return (
      <div
        className={clsx(cellBase, 'grid place-items-center bg-[#ffd98a]')}
        style={{ gridArea: cell.gridArea }}
      >
        <img
          src={cell.mascotPath}
          alt=""
          aria-hidden
          className="h-auto w-3/4"
          style={{ filter: 'drop-shadow(0 3px 0 rgba(0,0,0,0.15))' }}
        />
      </div>
    );
  }

  if (cell.kind === 'tiktok') {
    /**
     * Player v1 (vs embed v2) : iframe vidéo épurée, sans username, sans
     * panneau « Vidéos similaires », exactement 9:16. On cache la track
     * audio et la description pour rester sobre dans la cellule du bento.
     * Les contrôles et le bouton plein-écran restent dispo.
     */
    const params = new URLSearchParams({
      music_info: '0',
      description: '0',
      rel: '0',
      loop: '1',
      controls: '1',
      progress_bar: '1',
      play_button: '1',
      volume_control: '1',
      fullscreen_button: '1',
    });
    const src = `https://www.tiktok.com/player/v1/${cell.videoId}?${params.toString()}`;
    return (
      <div
        className={clsx(cellBase, 'bg-bento-ink')}
        style={{ gridArea: cell.gridArea }}
      >
        <iframe
          src={src}
          title="Vidéo TikTok"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
          loading="lazy"
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
    );
  }

  /**
   * Tag cell : photo plateau en plein cadre, sans texte par-dessus. Si pas de
   * photo → fallback avec le tint coloré et les libellés title/subtitle (cas
   * legacy / placeholder admin).
   */
  const hasPhoto = Boolean(cell.photoPath);
  return (
    <div
      className={clsx(cellBase, !hasPhoto && TONE_BG[cell.tone])}
      style={{ gridArea: cell.gridArea }}
      data-cell={cell.tone}
      title={`${cell.title} · ${cell.subtitle}`}
    >
      {hasPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cell.photoPath}
          alt={`${cell.title} · ${cell.subtitle}`}
          /*
           * `bp-bento-photo` + `data-tone` déclenchent une dérive lente
           * différente par cellule (cf. globals.css). Le scale(1.1) de base
           * laisse la marge nécessaire à la translation sans gap visible.
           */
          className="bp-bento-photo absolute inset-0 h-full w-full object-cover"
          data-tone={cell.tone}
          loading="lazy"
        />
      ) : (
        <div
          className={clsx(
            'absolute bottom-2 left-2.5 right-2.5 z-[1] font-bold uppercase tracking-[0.08em]',
            cell.tone === 'dh' ? 'text-bento-cream' : 'text-bento-ink',
          )}
        >
          <strong className="block text-[12px]">{cell.title}</strong>
          <span className="block text-[10px] font-medium opacity-80">{cell.subtitle}</span>
        </div>
      )}
    </div>
  );
}
