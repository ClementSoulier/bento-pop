import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

type AppShellProps = {
  user: { email: string; role: string };
  badges?: { events?: number; polls?: number };
  crumbs: string;
  title: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function AppShell({ user, badges, crumbs, title, actions, children }: AppShellProps) {
  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr]">
      <Sidebar user={user} badges={badges} />
      <div className="flex min-w-0 flex-col">
        <Topbar crumbs={crumbs} title={title} actions={actions} />
        <main className="flex-1 p-7">{children}</main>
      </div>
    </div>
  );
}
