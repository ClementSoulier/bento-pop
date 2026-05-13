import Link from 'next/link';
import { PageShell } from '@/components/AppShell/PageShell';
import { StatusBadge } from '@/components/StatusBadge';
import { createServerClient } from '@/lib/supabase/server';
import { formatDateBlock, formatNumber } from '@/lib/format';
import { ChevronRightIcon } from '@/components/icons';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createServerClient();

  // Listings limités pour la home (plus de détails dans /events et /polls).
  const [eventsRes, pollsRes, voteResults, subscribersRes, linksRes, showEpisodesRes, podcastEpisodesRes] =
    await Promise.all([
      supabase
        .from('landing_events')
        .select('id, date, title, status')
        .order('date', { ascending: true })
        .limit(5),
      supabase
        .from('landing_vote_weeks')
        .select('id, week_tag, question, is_current, ends_at')
        .order('starts_at', { ascending: false })
        .limit(5),
      supabase.from('landing_vote_results').select('option_id, votes'),
      supabase.from('landing_newsletter_subscribers').select('id', { count: 'exact', head: true }),
      supabase.from('landing_links').select('id, enabled', { count: 'exact' }),
      supabase
        .from('landing_show_episodes')
        .select('id, slug, title, season, episode_number, status, published_at')
        .order('display_order', { ascending: false })
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(5),
      supabase
        .from('landing_podcast_episodes')
        .select('id, slug, title, season, episode_number, status, published_at')
        .order('display_order', { ascending: false })
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(5),
    ]);

  const totalVotes = (voteResults.data ?? []).reduce(
    (sum, r) => sum + ((r as unknown as { votes: number }).votes ?? 0),
    0,
  );
  const linksTotal = linksRes.count ?? 0;
  const linksEnabled = (linksRes.data ?? []).filter((l) => (l as unknown as { enabled: boolean }).enabled).length;

  return (
    <PageShell crumbs="Bento Pop · accueil" title="Dashboard">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Événements à venir" value={(eventsRes.data ?? []).filter((e) => (e as unknown as { status: string }).status === 'soon').length} hint="dans l'agenda" />
        <StatCard label="Sondages actifs" value={(pollsRes.data ?? []).filter((p) => (p as unknown as { is_current: boolean }).is_current).length} hint={`${formatNumber(totalVotes)} votes cumulés`} />
        <StatCard label="Liens" value={linksEnabled} hint={`${linksTotal - linksEnabled} désactivés`} />
        <StatCard label="Newsletter" value={subscribersRes.count ?? 0} hint="abonnés cumulés" />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-5">
        <Card title="Émissions récentes" link={{ label: 'Voir tout', href: '/emissions' }}>
          <EpisodeList rows={showEpisodesRes.data ?? []} basePath="/emissions" />
        </Card>

        <Card title="Podcasts récents" link={{ label: 'Voir tout', href: '/podcasts' }}>
          <EpisodeList rows={podcastEpisodesRes.data ?? []} basePath="/podcasts" />
        </Card>

        <Card title="Prochains événements" link={{ label: 'Voir tout', href: '/events' }}>
          <div className="flex flex-col">
            {(eventsRes.data ?? []).length === 0 ? (
              <Empty>Aucun événement.</Empty>
            ) : (
              (eventsRes.data ?? []).map((e) => {
                const ev = e as unknown as { id: string; date: string; title: string; status: 'live' | 'soon' | 'done' };
                const d = formatDateBlock(ev.date);
                return (
                  <Link
                    key={ev.id}
                    href={`/events`}
                    className="flex items-center gap-4 border-b border-admin-border px-1 py-3 last:border-b-0 hover:bg-admin-bg/40"
                  >
                    <div className="w-14 text-center">
                      <div className="font-display text-[24px] leading-none">{d.day}</div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-admin-muted">{d.month}</div>
                    </div>
                    <div className="flex-1 truncate text-[13px] font-semibold">{ev.title}</div>
                    <StatusBadge status={ev.status} />
                  </Link>
                );
              })
            )}
          </div>
        </Card>

        <Card title="Sondages" link={{ label: 'Voir tout', href: '/polls' }}>
          <div className="flex flex-col">
            {(pollsRes.data ?? []).length === 0 ? (
              <Empty>Aucun sondage.</Empty>
            ) : (
              (pollsRes.data ?? []).map((p) => {
                const poll = p as unknown as { id: string; week_tag: string; question: string; is_current: boolean };
                return (
                  <Link
                    key={poll.id}
                    href="/polls"
                    className="flex items-center gap-3 border-b border-admin-border px-1 py-3 last:border-b-0 hover:bg-admin-bg/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-admin-muted">{poll.week_tag}</div>
                      <div className="truncate text-[13px] font-semibold">{poll.question}</div>
                    </div>
                    {poll.is_current ? <StatusBadge status="live" /> : <StatusBadge status="archived" />}
                  </Link>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </PageShell>
  );
}

function StatCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="admin-card flex flex-col gap-1 p-4">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-admin-muted">{label}</span>
      <span className="font-display text-[36px] leading-none">{formatNumber(value)}</span>
      <span className="text-[11px] text-admin-muted">{hint}</span>
    </div>
  );
}

function Card({
  title,
  link,
  children,
}: {
  title: string;
  link?: { label: string; href: string };
  children: React.ReactNode;
}) {
  return (
    <section className="admin-card overflow-hidden">
      <header className="flex items-center justify-between border-b border-admin-border px-4 py-3.5">
        <h3 className="text-[14px] font-semibold">{title}</h3>
        {link ? (
          <Link
            href={link.href}
            className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.1em] text-admin-muted hover:text-admin-ink"
          >
            {link.label}
            <ChevronRightIcon className="h-3 w-3" />
          </Link>
        ) : null}
      </header>
      <div className="px-4 py-2">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-2 py-6 text-center text-[12px] text-admin-muted">{children}</div>;
}

function EpisodeList({
  rows,
  basePath,
}: {
  rows: unknown[];
  basePath: string;
}) {
  const episodes = rows as Array<{
    id: string;
    slug: string;
    title: string;
    season: number;
    episode_number: number | null;
    status: 'draft' | 'published';
    published_at: string | null;
  }>;
  if (episodes.length === 0) return <Empty>Aucun épisode encore.</Empty>;
  return (
    <div className="flex flex-col">
      {episodes.map((e) => (
        <Link
          key={e.id}
          href={basePath}
          className="flex items-center gap-3 border-b border-admin-border px-1 py-3 last:border-b-0 hover:bg-admin-bg/40"
        >
          <div className="w-14 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-admin-muted">
            S{e.season}
            {e.episode_number != null ? `·E${e.episode_number}` : ''}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold">{e.title}</div>
            <div className="font-mono text-[10px] text-admin-muted">/{e.slug}</div>
          </div>
          <StatusBadge
            status={e.status === 'published' ? 'live' : 'draft'}
            label={e.status === 'published' ? 'Publié' : 'Brouillon'}
          />
        </Link>
      ))}
    </div>
  );
}
