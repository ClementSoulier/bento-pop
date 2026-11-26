import { PageShell } from '@/components/AppShell/PageShell';
import type { SubscriberRow } from '@/lib/newsletter';
import { createServerClient } from '@/lib/supabase/server';
import { NewsletterClient } from './NewsletterClient';

export const dynamic = 'force-dynamic';

/** PostgREST rend au plus 1 000 lignes par requête : on lit la liste par pages. */
const PAGE = 1000;
const MAX_ROWS = 50_000;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

async function loadSubscribers(): Promise<{ rows: SubscriberRow[]; error: string | null }> {
  const supabase = await createServerClient();
  const rows: SubscriberRow[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await supabase
      .from('landing_newsletter_subscribers')
      .select('id, email, source, consent_at')
      .order('consent_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return { rows, error: error.message };
    rows.push(...((data ?? []) as SubscriberRow[]));
    if (!data || data.length < PAGE) break;
  }
  return { rows, error: null };
}

export default async function NewsletterPage() {
  const { rows, error } = await loadSubscribers();
  const since = Date.now() - MONTH_MS;
  const lastMonth = rows.filter((r) => new Date(r.consent_at).getTime() >= since).length;
  return (
    <PageShell
      crumbs={`Landing · ${rows.length} inscrit${rows.length > 1 ? 's' : ''}`}
      title="Newsletter"
    >
      {error ? (
        <div className="admin-card mb-5 border-l-4 border-l-bento-red p-4 text-[13px]">
          La liste n’a pas pu être lue en entier : {error}
        </div>
      ) : null}
      <NewsletterClient rows={rows} lastMonth={lastMonth} />
    </PageShell>
  );
}
