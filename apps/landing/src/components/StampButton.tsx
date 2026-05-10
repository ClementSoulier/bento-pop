import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { clsx } from '@/lib/clsx';

type Variant = 'primary' | 'default';
type Size = 'md' | 'lg';

type CommonProps = {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  className?: string;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
};

const baseClasses =
  'inline-flex items-center gap-2.5 font-body font-bold uppercase tracking-[0.1em] ' +
  'border-[3px] border-bento-ink rounded-full shadow-stamp ' +
  'transition-[transform,box-shadow] duration-100 ease-out ' +
  'hover:-translate-y-0.5 hover:shadow-stamp-lg ' +
  'active:translate-y-0.5 active:shadow-[0_3px_0_var(--bento-ink)]';

const sizeClasses: Record<Size, string> = {
  md: 'text-[13px] px-4 pt-2 pb-1.5',
  lg: 'text-[15px] px-6 pt-4 pb-3',
};

const variantClasses: Record<Variant, string> = {
  primary: 'bg-bento-red text-bento-cream',
  default: 'bg-bento-cream text-bento-ink',
};

function getClassName({
  variant = 'default',
  size = 'md',
  className,
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
}) {
  return clsx(baseClasses, sizeClasses[size], variantClasses[variant], className);
}

type AnchorProps = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children' | 'className'> & { href: string };

export function StampLink({
  variant,
  size,
  children,
  className,
  iconLeft,
  iconRight,
  href,
  ...rest
}: AnchorProps) {
  return (
    <a className={getClassName({ variant, size, className })} href={href} {...rest}>
      {iconLeft ? <span className="inline-flex h-[18px] w-[18px] items-center justify-center">{iconLeft}</span> : null}
      <span>{children}</span>
      {iconRight ? <span className="inline-flex h-[18px] w-[18px] items-center justify-center">{iconRight}</span> : null}
    </a>
  );
}

type ButtonProps = CommonProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'>;

export function StampButton({
  variant,
  size,
  children,
  className,
  iconLeft,
  iconRight,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={getClassName({ variant, size, className })} {...rest}>
      {iconLeft ? <span className="inline-flex h-[18px] w-[18px] items-center justify-center">{iconLeft}</span> : null}
      <span>{children}</span>
      {iconRight ? <span className="inline-flex h-[18px] w-[18px] items-center justify-center">{iconRight}</span> : null}
    </button>
  );
}
