import type { ReactNode } from 'react';
import { Topbar } from './Topbar';

type PageShellProps = {
  crumbs: string;
  title: string;
  actions?: ReactNode;
  children: ReactNode;
};

/**
 * Wrapper de page : Topbar collante + zone de contenu paddée.
 * À utiliser dans chaque page.tsx du groupe (protected).
 */
export function PageShell({ crumbs, title, actions, children }: PageShellProps) {
  return (
    <>
      <Topbar crumbs={crumbs} title={title} actions={actions} />
      <main className="flex-1 p-7">{children}</main>
    </>
  );
}
