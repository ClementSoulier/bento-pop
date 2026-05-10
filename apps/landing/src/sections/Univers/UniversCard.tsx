import type { UniversItem, UniversTone } from '@/lib/content/schemas';
import { clsx } from '@/lib/clsx';

type UniversCardProps = {
  item: UniversItem;
  /** Première carte = grande typo. */
  featured?: boolean;
  /** Photo plateau en background décoratif (semi-transparent). */
  photoPath?: string;
};

const TONE_BG: Record<UniversTone, string> = {
  cinema: 'bg-gradient-to-br from-[#ffd6a8] to-[#ffb877]',
  gaming: 'bg-gradient-to-br from-[#c5e8ff] to-[#88c8ff]',
  japan: 'bg-gradient-to-br from-[#ffc5d8] to-[#ff8fb0]',
  societe: 'bg-gradient-to-br from-[#d4f4d2] to-[#94d690]',
};

export function UniversCard({ item, featured = false, photoPath }: UniversCardProps) {
  return (
    <article
      className={clsx(
        'relative flex flex-col justify-between overflow-hidden',
        'border-[5px] border-bento-ink rounded-[22px] px-6 pb-6 pt-7 shadow-stamp-lg',
        'transition-[transform,box-shadow] duration-150 hover:-translate-y-1 hover:shadow-[0_8px_0_var(--bento-ink)]',
        TONE_BG[item.tone],
      )}
    >
      {/*
        Photo en background : opacité réduite + mix-blend-multiply pour que le
        gradient de la carte teinte la photo, et inversement. Donne un fond
        « sympa » qui rappelle le plateau sans dominer la lisibilité du texte.
      */}
      {photoPath ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoPath}
            alt=""
            aria-hidden
            loading="lazy"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30 mix-blend-multiply"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/0 via-white/30 to-white/60"
          />
        </>
      ) : null}

      <div className="relative z-[1]">
        <div
          className={clsx(
            'mb-4 grid place-items-center border-[3px] border-bento-ink rounded-[18px] bg-bento-cream shadow-stamp',
            featured ? 'h-20 w-20' : 'h-16 w-16',
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.mascotPath}
            alt=""
            aria-hidden
            className="h-[88%] w-[88%] object-contain"
            style={{ filter: 'drop-shadow(0 2px 0 rgba(0,0,0,0.15))' }}
          />
        </div>
        <h3
          className={clsx(
            'font-display mb-2.5 leading-[0.95] whitespace-pre-line',
            featured ? 'text-[clamp(40px,5vw,64px)]' : 'text-[clamp(28px,3.5vw,42px)]',
          )}
        >
          {item.title}
        </h3>
        <p className="mb-4 text-[15px] leading-[1.45] text-bento-ink/85 text-pretty">
          {item.description}
        </p>
      </div>
      <div className="relative z-[1] flex flex-wrap gap-1.5">
        {item.tags.map((t) => (
          <span
            key={t}
            className="rounded-full border-2 border-bento-ink bg-white/75 px-2.5 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-[0.12em]"
          >
            {t}
          </span>
        ))}
      </div>
    </article>
  );
}
