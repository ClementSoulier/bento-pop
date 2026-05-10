import { clsx } from '@/lib/clsx';

type EyebrowProps = {
  children: React.ReactNode;
  tone?: 'red' | 'yellow';
  className?: string;
};

/**
 * Petit label tout-caps précédé d'une barre rouge.
 * Utilisé en tête de chaque section.
 *
 * A11y : sur fonds clairs (jaune/crème), le rouge n'atteint pas WCAG AA pour
 * du texte normal (~2.3:1 sur jaune, ~3.4:1 sur crème). On garde la barre
 * rouge comme accent visuel signature, mais le texte est en `bento-ink`
 * (contraste ~16:1). Sur fond ink (`tone="yellow"`), le jaune sur noir
 * passe largement.
 */
export function Eyebrow({ children, tone = 'red', className }: EyebrowProps) {
  const color = tone === 'red' ? 'text-bento-ink' : 'text-bento-yellow';
  const barColor = tone === 'red' ? 'bg-bento-red' : 'bg-bento-yellow';
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.3em]',
        color,
        className,
      )}
    >
      <span className={clsx('inline-block h-[3px] w-7 rounded-[3px]', barColor)} />
      {children}
    </span>
  );
}
