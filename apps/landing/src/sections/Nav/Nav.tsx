import Image from 'next/image';
import Link from 'next/link';
import logo from '@bento-pop/brand/assets/logo/bento-pop.png';
import { getNav, getNavCta } from '@/content/nav';
import { iconRegistry } from '@/components/icons';
import { NavLink } from './NavLink';
import { MobileNav } from './MobileNav';

export async function Nav() {
  const [links, cta] = await Promise.all([getNav(), getNavCta()]);
  const Icon = iconRegistry[cta.iconKey];
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 top-0 z-50 bg-bento-yellow border-b-[4px] border-bento-ink"
      style={{ boxShadow: '0 4px 0 var(--bento-ink), 0 6px 20px rgba(0,0,0,0.1)' }}
    >
      <div className="mx-auto flex max-w-[1320px] items-center gap-3 px-5 py-3 md:gap-6 md:px-7">
        <Link href="/" className="block w-[130px] shrink-0" aria-label="Bento Pop — accueil">
          <Image
            src={logo}
            alt="Bento Pop"
            priority
            className="w-full h-auto"
            style={{ filter: 'drop-shadow(0 2px 0 rgba(0,0,0,0.2))' }}
          />
        </Link>
        <div className="hidden flex-1 justify-center gap-1 md:flex">
          {links.map((link) => (
            <NavLink key={link.id} href={link.href}>
              {link.label}
            </NavLink>
          ))}
        </div>
        <a
          href={cta.href}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto hidden items-center gap-2 rounded-full border-[3px] border-bento-ink bg-bento-red px-4 pt-2 pb-1.5 font-bold uppercase tracking-[0.08em] text-[13px] text-bento-cream shadow-stamp transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-stamp-lg active:translate-y-0.5 active:shadow-[0_2px_0_var(--bento-ink)] sm:inline-flex"
        >
          <Icon width={16} height={16} aria-hidden />
          {cta.label}
        </a>
        <div className="ml-auto sm:ml-0">
          <MobileNav links={links} cta={cta} />
        </div>
      </div>
    </nav>
  );
}
