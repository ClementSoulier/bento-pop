import { clsx } from '@/lib/clsx';

type EyebrowProps = {
  children: React.ReactNode;
  tone?: 'red' | 'yellow';
  className?: string;
};

/**
 * Petit label tout-caps précédé d'une barre rouge.
 * Utilisé en tête de chaque section.
 */
export function Eyebrow({ children, tone = 'red', className }: EyebrowProps) {
  const color = tone === 'red' ? 'text-bento-red' : 'text-bento-yellow';
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
