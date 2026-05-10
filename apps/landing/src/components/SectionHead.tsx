import { Eyebrow } from './Eyebrow';
import { clsx } from '@/lib/clsx';

type SectionHeadProps = {
  eyebrow: string;
  title: string;
  description?: string;
  align?: 'center' | 'left';
  tone?: 'default' | 'dark';
  className?: string;
};

/**
 * En-tête d'une section : eyebrow + h2 display + lead descriptif.
 * `tone="dark"` pour les sections sur fond ink (Vote, Footer).
 */
export function SectionHead({
  eyebrow,
  title,
  description,
  align = 'center',
  tone = 'default',
  className,
}: SectionHeadProps) {
  const isDark = tone === 'dark';
  return (
    <div
      className={clsx(
        'mb-14',
        align === 'center' ? 'text-center' : 'text-left',
        className,
      )}
    >
      <Eyebrow tone={isDark ? 'yellow' : 'red'}>{eyebrow}</Eyebrow>
      <h2
        className={clsx(
          'font-display mt-3 mb-3.5',
          'text-[clamp(36px,5vw,64px)]',
          /* `whitespace-pre-line` rend les `\n` du content comme des sauts de
             ligne tout en collapsant les autres whitespace runs — permet de
             forcer une mise en page « marketing » multi-lignes via le BO. */
          'whitespace-pre-line',
          isDark ? 'text-bento-cream' : 'text-bento-ink',
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={clsx(
            'mx-auto max-w-[620px] text-[17px] leading-[1.5] text-pretty',
            'whitespace-pre-line',
            align === 'left' && 'mx-0',
            isDark ? 'text-bento-cream/75' : 'text-bento-ink/75',
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
