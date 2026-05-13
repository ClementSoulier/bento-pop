'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import logo from '@bento-pop/brand/assets/logo/bento-pop.png';
import {
  CalendarIcon,
  DashboardIcon,
  EyeIcon,
  LinkIcon,
  LogoutIcon,
  MicIcon,
  PlayIcon,
  PollIcon,
  SettingsIcon,
  UsersIcon,
} from '@/components/icons';
import { signOut } from '@/lib/auth-actions';
import { clsx } from '@/lib/clsx';

type SidebarProps = {
  user: { email: string; role: string };
  badges?: { events?: number; polls?: number; emissions?: number; podcasts?: number };
};

const NAV = [
  { id: 'dashboard', href: '/',         label: 'Dashboard',  Icon: DashboardIcon },
  { id: 'emissions', href: '/emissions',label: 'Émissions',  Icon: PlayIcon },
  { id: 'podcasts',  href: '/podcasts', label: 'Podcasts',   Icon: MicIcon },
  { id: 'events',    href: '/events',   label: 'Événements', Icon: CalendarIcon },
  { id: 'polls',     href: '/polls',    label: 'Sondages',   Icon: PollIcon },
  { id: 'links',     href: '/links',    label: 'Liens & CTAs', Icon: LinkIcon },
  { id: 'team',      href: '/team',     label: 'Team',       Icon: UsersIcon },
  { id: 'bentos',    href: '/bentos',   label: 'Bentos (mobile)', Icon: DashboardIcon },
  { id: 'reports',   href: '/reports',  label: 'Modération',      Icon: PollIcon },
] as const;

const SYSTEM_NAV = [
  { id: 'config', href: '/config', label: 'Configuration', Icon: SettingsIcon },
] as const;

export function Sidebar({ user, badges }: SidebarProps) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');

  const initials = user.email
    .split('@')[0]
    ?.split(/[.\-_]/)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('') || 'BP';

  return (
    <aside className="sticky top-0 flex h-screen w-[240px] flex-col border-r border-admin-border bg-admin-surface px-4 py-5">
      <div className="mb-4 flex items-center gap-2.5 border-b border-admin-border pb-4">
        <Image src={logo} alt="Bento Pop" className="h-auto w-24" />
        <span className="ml-auto rounded bg-bento-yellow px-1.5 pt-0.5 pb-px font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-bento-ink">
          Admin
        </span>
      </div>

      <SectionLabel>Pilotage</SectionLabel>
      <nav className="flex flex-col gap-px">
        {NAV.map((n) => {
          const active = isActive(n.href);
          const badge =
            n.id === 'events'
              ? badges?.events
              : n.id === 'polls'
                ? badges?.polls
                : n.id === 'emissions'
                  ? badges?.emissions
                  : n.id === 'podcasts'
                    ? badges?.podcasts
                    : undefined;
          return (
            <Link
              key={n.id}
              href={n.href}
              className={clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors',
                active
                  ? 'bg-admin-ink font-semibold text-bento-cream'
                  : 'text-admin-ink-2 hover:bg-admin-bg hover:text-admin-ink',
              )}
            >
              <n.Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{n.label}</span>
              {badge ? (
                <span
                  className={clsx(
                    'rounded-full px-1.5 py-px font-mono text-[10px] font-semibold',
                    active ? 'bg-bento-yellow text-admin-ink' : 'bg-admin-bg text-admin-muted',
                  )}
                >
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <SectionLabel className="mt-4">Système</SectionLabel>
      <nav className="flex flex-col gap-px">
        {SYSTEM_NAV.map((n) => {
          const active = isActive(n.href);
          return (
            <Link
              key={n.id}
              href={n.href}
              className={clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors',
                active
                  ? 'bg-admin-ink font-semibold text-bento-cream'
                  : 'text-admin-ink-2 hover:bg-admin-bg hover:text-admin-ink',
              )}
            >
              <n.Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{n.label}</span>
            </Link>
          );
        })}
      </nav>

      <SectionLabel className="mt-4">Site</SectionLabel>
      <a
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-admin-ink-2 transition-colors hover:bg-admin-bg hover:text-admin-ink"
      >
        <EyeIcon className="h-4 w-4 shrink-0" />
        <span>Voir la landing</span>
      </a>

      <div className="mt-auto border-t border-admin-border pt-4">
        <div className="flex items-center gap-2.5 rounded-lg p-2 hover:bg-admin-bg">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-admin-ink text-[11px] font-bold text-bento-yellow">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold leading-tight">{user.email}</div>
            <div className="font-mono text-[10px] text-admin-muted">{user.role}</div>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              title="Se déconnecter"
              className="grid h-8 w-8 place-items-center rounded-md text-admin-muted transition-colors hover:bg-admin-surface hover:text-admin-ink"
            >
              <LogoutIcon />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={clsx(
        'px-3 pt-3 pb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-admin-muted-2',
        className,
      )}
    >
      {children}
    </div>
  );
}
