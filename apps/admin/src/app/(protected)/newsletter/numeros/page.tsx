import Link from 'next/link';
import { PageShell } from '@/components/AppShell/PageShell';
import { PlusIcon } from '@/components/icons';
import { IssueStatusBadge } from '@/components/newsletter/IssueStatusBadge';
import { NewsletterTabs } from '@/components/newsletter/NewsletterTabs';
import { formatNumber } from '@/lib/format';
import { formatParisDate } from '@/lib/newsletter/issue';
import { ISSUE_SUMMARY_COLUMNS, refreshIssue, type IssueSummary } from '@/lib/newsletter/issues';
import { newsletterResendFromEnv } from '@/lib/newsletter/resend';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function when(issue: IssueSummary): string {
  if (issue.status === 'sent') return `Envoyé le ${formatParisDate(issue.sent_at ?? issue.updated_at)}`;
  if (issue.status === 'scheduled') return `Programmé pour le ${formatParisDate(issue.scheduled_at)}`;
  if (issue.status === 'sending') return `Confié à Resend le ${formatParisDate(issue.updated_at)}`;
  return `Modifié le ${formatParisDate(issue.updated_at)}`;
}

/** L'historique des numéros (docs/NEWSLETTER-ENVOI.md, D11). */
export default async function IssuesPage() {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('newsletter_issues')
    .select(ISSUE_SUMMARY_COLUMNS)
    .order('created_at', { ascending: false });
  const nr = newsletterResendFromEnv();
  const issues = await Promise.all(
    ((data ?? []) as unknown as IssueSummary[]).map((row) =>
      refreshIssue(supabase, nr, row, ISSUE_SUMMARY_COLUMNS),
    ),
  );

  return (
    <PageShell
      crumbs={`Newsletter · ${issues.length} numéro${issues.length > 1 ? 's' : ''}`}
      title="Newsletter"
      actions={
        <Link href="/newsletter/numeros/nouveau" className="admin-btn admin-btn-primary">
          <PlusIcon />
          Nouveau numéro
        </Link>
      }
    >
      <NewsletterTabs active="numeros" />
      {error ? (
        <div role="alert" className="admin-card mb-5 border-l-4 border-l-bento-red p-4 text-[13px]">
          Les numéros n’ont pas pu être lus : {error.message}
        </div>
      ) : null}
      {!nr ? (
        <div className="admin-card mb-5 border-l-4 border-l-bento-yellow p-4 text-[13px]">
          L’envoi n’est pas encore branché : les brouillons s’écrivent, mais rien ne part tant que{' '}
          <code>RESEND_NEWSLETTER_API_KEY</code> et <code>RESEND_NEWSLETTER_SEGMENT_ID</code> ne sont pas
          posées sur l’app back-office (Coolify, variables runtime).
        </div>
      ) : null}

      <div className="admin-card overflow-hidden">
        <table className="w-full text-left">
          <thead className="border-b border-admin-border bg-admin-surface-2">
            <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-admin-muted">
              <th className="px-4 py-2.5">Objet</th>
              <th className="px-4 py-2.5">Statut</th>
              <th className="px-4 py-2.5 text-right">Destinataires</th>
              <th className="px-4 py-2.5 text-right">Partis</th>
              <th className="px-4 py-2.5 text-right">Rebonds</th>
              <th className="px-4 py-2.5 text-right">Plaintes</th>
            </tr>
          </thead>
          <tbody>
            {issues.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-[13px] text-admin-muted">
                  Aucun numéro pour l’instant. « Nouveau numéro » pour déposer le premier.
                </td>
              </tr>
            ) : (
              issues.map((issue) => (
                <tr key={issue.id} className="border-b border-admin-border last:border-b-0 hover:bg-admin-bg/40">
                  <td className="px-4 py-3">
                    <Link href={`/newsletter/numeros/${issue.id}`} className="text-[13px] font-semibold hover:underline">
                      {issue.subject.trim() || 'Numéro sans objet'}
                    </Link>
                    <div className="mt-0.5 font-mono text-[11px] text-admin-muted">{when(issue)}</div>
                    {issue.last_error && issue.status !== 'sent' ? (
                      <div className="mt-0.5 text-[11px] text-bento-red">{issue.last_error}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <IssueStatusBadge status={issue.status} />
                  </td>
                  <Count value={issue.status === 'draft' ? null : issue.recipients} />
                  <Count value={issue.status === 'draft' ? null : issue.delivered} />
                  <Count value={issue.status === 'draft' ? null : issue.bounces} alert />
                  <Count value={issue.status === 'draft' ? null : issue.complaints} alert />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}

function Count({ value, alert = false }: { value: number | null; alert?: boolean }) {
  return (
    <td
      className={`px-4 py-3 text-right font-mono text-[12px] ${alert && value ? 'font-semibold text-bento-red' : ''}`}
    >
      {value === null ? '' : formatNumber(value)}
    </td>
  );
}
