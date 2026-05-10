import Link from 'next/link';

type NavLinkProps = {
  href: string;
  children: React.ReactNode;
};

export function NavLink({ href, children }: NavLinkProps) {
  return (
    <Link
      href={href}
      className="rounded-full px-3.5 py-2 font-bold uppercase tracking-[0.1em] text-[13px] transition-colors hover:bg-bento-ink/10"
    >
      {children}
    </Link>
  );
}
