import { PageShell } from '@/components/AppShell/PageShell';
import { NewsletterTabs } from '@/components/newsletter/NewsletterTabs';
import { loadSubscribers } from '@/lib/newsletter/load-subscribers';
import { createServerClient } from '@/lib/supabase/server';
import { NewsletterClient } from './NewsletterClient';

export const dynamic = 'force-dynamic';

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export default async function NewsletterPage() {
  const { rows, error } = await loadSubscribers(await createServerClient());
  const since = Date.now() - MONTH_MS;
  const lastMonth = rows.filter((r) => new Date(r.consent_at).getTime() >= since).length;
  return (
    <PageShell
      crumbs={`Landing · ${rows.length} inscrit${rows.length > 1 ? 's' : ''}`}
      title="Newsletter"
    >
      <NewsletterTabs active="inscrits" />
      {error ? (
        <div className="admin-card mb-5 border-l-4 border-l-bento-red p-4 text-[13px]">
          La liste n’a pas pu être lue en entier : {error}
        </div>
      ) : null}
      <NewsletterClient rows={rows} lastMonth={lastMonth} />
    </PageShell>
  );
}
