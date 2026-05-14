import { PageShell } from '@/components/AppShell/PageShell';
import { createServerClient } from '@/lib/supabase/server';
import { PodcastsClient, type PodcastEpisodeRow } from './PodcastsClient';
import type { TeamMemberOption } from '@/components/episodes/HostsField';

export const dynamic = 'force-dynamic';

export default async function PodcastsPage() {
  const supabase = await createServerClient();

  const [episodesRes, hostsRes, teamRes] = await Promise.all([
    supabase
      .from('landing_podcast_episodes')
      .select(
        'id, slug, title, description, spotify_episode_id, thumbnail_url, duration_seconds, published_at, season, episode_number, status, display_order, seo_title, seo_description, guests, mentions, chapters',
      )
      .order('display_order', { ascending: false })
      .order('published_at', { ascending: false, nullsFirst: false }),
    supabase
      .from('landing_podcast_episode_hosts')
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

  const episodes: PodcastEpisodeRow[] = (
    (episodesRes.data ?? []) as unknown as PodcastEpisodeRow[]
  ).map((e) => ({ ...e, host_ids: hostsByEpisode.get(e.id) ?? [] }));

  return (
    <PageShell
      crumbs={`Podcasts · ${episodes.length} fiche${episodes.length > 1 ? 's' : ''}`}
      title="Podcasts Spotify"
    >
      <PodcastsClient episodes={episodes} team={team} />
    </PageShell>
  );
}
