import { notFound } from 'next/navigation';
import { PageShell } from '@/components/AppShell/PageShell';
import type { TeamMemberOption } from '@/components/episodes/HostsField';
import type { EpisodeOption } from '@/components/blog/RelatedEpisodesField';
import { EMPTY_DOC, type BlogDoc } from '@/lib/blog/document';
import { buildPollSnapshot, type PollResultRow, type PollSnapshot, type PollWeek } from '@/lib/blog/poll';
import type { RelatedEpisodeRef } from '@/lib/blog/schemas';
import { createServerClient } from '@/lib/supabase/server';
import { PostEditor, type EditablePost } from './PostEditor';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Params = Promise<{ id: string }>;

type EpisodeRow = {
  id: string;
  title: string;
  season: number;
  episode_number: number | null;
  status: 'draft' | 'published';
};

export default async function BlogPostPage({ params }: { params: Params }) {
  const { id } = await params;
  const isNew = id === 'nouveau';
  if (!isNew && !UUID.test(id)) notFound();

  const supabase = await createServerClient();

  const [postRes, authorsRes, relatedRes, teamRes, categoriesRes, showsRes, podcastsRes, weeksRes, votesRes] =
    await Promise.all([
      isNew
        ? Promise.resolve({ data: null })
        : supabase
            .from('landing_blog_posts')
            .select(
              'id, slug, title, excerpt, content, cover_url, cover_alt, category_id, status, published_at, seo_title, seo_description',
            )
            .eq('id', id)
            .maybeSingle(),
      isNew
        ? Promise.resolve({ data: [] })
        : supabase
            .from('landing_blog_post_authors')
            .select('team_member_id, display_order')
            .eq('post_id', id)
            .order('display_order', { ascending: true }),
      isNew
        ? Promise.resolve({ data: [] })
        : supabase
            .from('landing_blog_post_episodes')
            .select('show_episode_id, podcast_episode_id, display_order')
            .eq('post_id', id)
            .order('display_order', { ascending: true }),
      supabase.from('landing_team').select('id, name, nick').order('display_order', { ascending: true }),
      supabase
        .from('landing_blog_categories')
        .select('id, name')
        .order('display_order', { ascending: true })
        .order('name', { ascending: true }),
      supabase
        .from('landing_show_episodes')
        .select('id, title, season, episode_number, status')
        .order('season', { ascending: false })
        .order('episode_number', { ascending: false, nullsFirst: false }),
      supabase
        .from('landing_podcast_episodes')
        .select('id, title, season, episode_number, status')
        .order('season', { ascending: false })
        .order('episode_number', { ascending: false, nullsFirst: false }),
      supabase
        .from('landing_vote_weeks')
        .select('id, week_tag, question, options')
        .order('starts_at', { ascending: false }),
      supabase.from('landing_vote_results').select('week_id, option_id, votes'),
    ]);

  const raw = postRes.data as unknown as (Omit<EditablePost, 'author_ids' | 'related' | 'content'> & {
    content: BlogDoc | null;
  }) | null;
  if (!isNew && !raw) notFound();

  const post: EditablePost | null = raw
    ? {
        ...raw,
        content: raw.content ?? EMPTY_DOC,
        author_ids: ((authorsRes.data ?? []) as Array<{ team_member_id: string }>).map(
          (a) => a.team_member_id,
        ),
        related: ((relatedRes.data ?? []) as Array<{
          show_episode_id: string | null;
          podcast_episode_id: string | null;
        }>).flatMap((r): RelatedEpisodeRef[] =>
          r.show_episode_id
            ? [{ kind: 'show', id: r.show_episode_id }]
            : r.podcast_episode_id
              ? [{ kind: 'podcast', id: r.podcast_episode_id }]
              : [],
        ),
      }
    : null;

  const team = ((teamRes.data ?? []) as TeamMemberOption[]).map((m) => ({
    id: m.id,
    name: m.name,
    nick: m.nick,
  }));
  const categories = (categoriesRes.data ?? []) as Array<{ id: string; name: string }>;
  const toOption =
    (kind: 'show' | 'podcast') =>
    (e: EpisodeRow): EpisodeOption => ({
      kind,
      id: e.id,
      title: e.title,
      label: `S${e.season}${e.episode_number != null ? ` · E${e.episode_number}` : ''}`,
      draft: e.status === 'draft',
    });
  // Sondages du Thermomètre pour le bouton « Sondage » : chiffres lus maintenant, figés
  // dans l'article à l'insertion.
  const votesByWeek = new Map<string, PollResultRow[]>();
  for (const r of (votesRes.data ?? []) as Array<PollResultRow & { week_id: string }>) {
    const list = votesByWeek.get(r.week_id) ?? [];
    list.push(r);
    votesByWeek.set(r.week_id, list);
  }
  const readAt = new Date().toISOString();
  const polls: PollSnapshot[] = ((weeksRes.data ?? []) as unknown as PollWeek[])
    .map((w) => buildPollSnapshot(w, votesByWeek.get(w.id) ?? [], readAt))
    .filter((p) => p.options.length >= 2);

  const episodes: EpisodeOption[] = [
    ...((showsRes.data ?? []) as EpisodeRow[]).map(toOption('show')),
    ...((podcastsRes.data ?? []) as EpisodeRow[]).map(toOption('podcast')),
  ];

  return (
    <PageShell
      crumbs={isNew ? 'Blog · nouvel article' : `Blog · ${post?.slug ?? ''}`}
      title={isNew ? 'Nouvel article' : (post?.title ?? 'Article')}
    >
      <PostEditor
        key={post?.id ?? 'nouveau'}
        post={post}
        team={team}
        categories={categories}
        episodes={episodes}
        polls={polls}
        landingUrl={process.env.LANDING_URL ?? null}
      />
    </PageShell>
  );
}
