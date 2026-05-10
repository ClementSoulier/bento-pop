import { PageShell } from '@/components/AppShell/PageShell';
import { createServerClient } from '@/lib/supabase/server';
import { PollsClient, type PollRow, type PollOption } from './PollsClient';

export const dynamic = 'force-dynamic';

type WeekRow = {
  id: string;
  week_tag: string;
  question: string;
  options: PollOption[];
  ends_at: string;
  is_current: boolean;
};

export default async function PollsPage() {
  const supabase = await createServerClient();
  const [weeksRes, resultsRes] = await Promise.all([
    supabase
      .from('landing_vote_weeks')
      .select('id, week_tag, question, options, ends_at, is_current')
      .order('starts_at', { ascending: false }),
    supabase.from('landing_vote_results').select('week_id, votes'),
  ]);

  const weeks = (weeksRes.data ?? []) as unknown as WeekRow[];
  const totals = new Map<string, number>();
  for (const r of (resultsRes.data ?? []) as unknown as { week_id: string; votes: number }[]) {
    totals.set(r.week_id, (totals.get(r.week_id) ?? 0) + (r.votes ?? 0));
  }

  const polls: PollRow[] = weeks.map((w) => ({
    id: w.id,
    week_tag: w.week_tag,
    question: w.question,
    options: w.options ?? [],
    ends_at: w.ends_at,
    is_current: w.is_current,
    total_votes: totals.get(w.id) ?? 0,
  }));

  return (
    <PageShell crumbs="Thermomètre Pop Culture" title="Sondages">
      <PollsClient polls={polls} />
    </PageShell>
  );
}
