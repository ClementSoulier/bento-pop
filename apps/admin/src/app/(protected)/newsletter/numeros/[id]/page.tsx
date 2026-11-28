import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageShell } from '@/components/AppShell/PageShell';
import { requireAdmin } from '@/lib/auth';
import { ISSUE_COLUMNS, refreshIssue, type IssueRow } from '@/lib/newsletter/issues';
import { newsletterResendFromEnv } from '@/lib/newsletter/resend';
import { createServerClient } from '@/lib/supabase/server';
import { IssueEditor } from './IssueEditor';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Params = Promise<{ id: string }>;

export default async function IssuePage({ params }: { params: Params }) {
  const { id } = await params;
  const isNew = id === 'nouveau';
  if (!isNew && !UUID.test(id)) notFound();

  const session = await requireAdmin();
  const supabase = await createServerClient();
  const nr = newsletterResendFromEnv();

  let issue: IssueRow | null = null;
  if (!isNew) {
    const { data } = await supabase.from('newsletter_issues').select(ISSUE_COLUMNS).eq('id', id).maybeSingle();
    if (!data) notFound();
    issue = await refreshIssue(supabase, nr, data as unknown as IssueRow);
  }

  const { count } = await supabase
    .from('landing_newsletter_subscribers')
    .select('id', { count: 'exact', head: true });

  const landingUrl = (process.env.LANDING_URL || 'https://bento-pop.com').replace(/\/+$/, '');

  return (
    <PageShell
      crumbs="Newsletter · Numéros"
      title={isNew ? 'Nouveau numéro' : issue?.subject.trim() || 'Numéro sans objet'}
      actions={
        <Link href="/newsletter/numeros" className="admin-btn">
          Tous les numéros
        </Link>
      }
    >
      <IssueEditor
        key={issue?.id ?? 'nouveau'}
        issue={issue}
        defaultTestEmail={session.email}
        configured={nr !== null}
        subscribers={count ?? 0}
        testUnsubscribeUrl={`${landingUrl}/confidentialite#newsletter`}
      />
    </PageShell>
  );
}
