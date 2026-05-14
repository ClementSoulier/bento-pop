import { PageShell } from '@/components/AppShell/PageShell';
import { createServerClient } from '@/lib/supabase/server';
import { EmissionsClient, type ShowEpisodeRow } from './EmissionsClient';
import type { TeamMemberOption } from '@/components/episodes/HostsField';

export const dynamic = 'force-dynamic';

export default async function EmissionsPage() {
  const supabase = await createServerClient();

  const [episodesRes, hostsRes, teamRes] = await Promise.all([
    supabase
      .from('landing_show_episodes')
      .select(
        'id, slug, title, description, youtube_id, thumbnail_url, duration_seconds, published_at, season, episode_number, status, display_order, seo_title, seo_description, guests, mentions, chapters',
      )
      .order('display_order', { ascending: false })
      .order('published_at', { ascending: false, nullsFirst: false }),
    supabase
      .from('landing_show_episode_hosts')
      .select('episode_id, team_member_id, display_order')
      .order('display_order', { ascending: true }),
    supabase
      .from('landing_team')
      .select('id, name, nick')
      .order('display_order', { ascending: true }),
  ]);

  const team: TeamMemberOption[] = ((teamRes.data ?? []) as unknown as TeamMemberOption[]).map(
    (m) => ({ id: m.id, name: m.name, nick: m.nick }),
  );

  const hostsByEpisode = new Map<string, string[]>();
  for (const h of (hostsRes.data ?? []) as unknown as Array<{
    episode_id: string;
    team_member_id: string;
  }>) {
    const arr = hostsByEpisode.get(h.episode_id) ?? [];
    arr.push(h.team_member_id);
    hostsByEpisode.set(h.episode_id, arr);
  }

  const episodes: ShowEpisodeRow[] = ((episodesRes.data ?? []) as unknown as ShowEpisodeRow[]).map(
    (e) => ({ ...e, host_ids: hostsByEpisode.get(e.id) ?? [] }),
  );

  return (
    <PageShell
      crumbs={`Émissions · ${episodes.length} fiche${episodes.length > 1 ? 's' : ''}`}
      title="Émissions YouTube"
    >
      <EmissionsClient episodes={episodes} team={team} />
    </PageShell>
  );
}
