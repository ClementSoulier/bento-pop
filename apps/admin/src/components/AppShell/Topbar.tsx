import { BellIcon, SearchIcon } from '@/components/icons';

type TopbarProps = {
  crumbs: string;
  title: string;
  actions?: React.ReactNode;
};

export function Topbar({ crumbs, title, actions }: TopbarProps) {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-admin-border bg-admin-surface px-7 py-4">
      <div className="min-w-0">
        <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-admin-muted">
          {crumbs}
        </div>
        <h1 className="font-display whitespace-nowrap text-[22px] leading-none">{title}</h1>
      </div>
      <div className="flex-1" />
      <div className="relative w-[280px]">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-admin-muted" />
        <input
          type="search"
          placeholder="Rechercher événement, sondage…"
          className="w-full rounded-admin-input border border-admin-border bg-admin-bg py-2 pl-9 pr-12 text-[13px] outline-none transition-colors focus:border-admin-ink focus:bg-admin-surface"
          disabled
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-admin-border bg-admin-surface px-1.5 py-0.5 font-mono text-[10px] text-admin-muted">
          ⌘K
        </kbd>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      <button
        type="button"
        title="Notifications"
        className="relative grid h-8 w-8 place-items-center rounded-md border border-transparent text-admin-muted transition-colors hover:border-admin-border hover:bg-admin-surface hover:text-admin-ink"
      >
        <BellIcon className="h-4 w-4" />
      </button>
    </header>
  );
}
