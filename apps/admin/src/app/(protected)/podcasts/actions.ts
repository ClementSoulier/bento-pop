'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { datetimeLocalToIso } from '@/lib/episodes/format';
import { podcastEpisodeSchema, type PodcastEpisodePayload } from '@/lib/episodes/schemas';

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

function revalidate() {
  revalidatePath('/');
  revalidatePath('/podcasts');
}

export async function savePodcastEpisode(input: PodcastEpisodePayload): Promise<ActionResult> {
  await requireAdmin();
  const parsed = podcastEpisodeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Champs invalides' };
  }
  const data = parsed.data;
  const supabase = await createServerClient();

  const row = {
    slug: data.slug,
    title: data.title,
    description: data.description ?? '',
    spotify_episode_id: data.spotify_episode_id,
    thumbnail_url: data.thumbnail_url || null,
    duration_seconds: data.duration_seconds ?? null,
    published_at: datetimeLocalToIso(data.published_at ?? ''),
    season: data.season,
    episode_number: data.episode_number ?? null,
    status: data.status,
    display_order: data.display_order,
    seo_title: data.seo_title || null,
    seo_description: data.seo_description || null,
    guests: data.guests,
    mentions: data.mentions,
    chapters: data.chapters,
  };

  let episodeId = data.id;
  if (episodeId) {
    const { error } = await supabase
      .from('landing_podcast_episodes')
      .update(row as never)
      .eq('id', episodeId);
    if (error) return { ok: false, error: friendlySupabaseError(error.message) };
  } else {
    const { data: inserted, error } = await supabase
      .from('landing_podcast_episodes')
      .insert(row as never)
      .select('id')
      .single();
    if (error || !inserted) {
      return { ok: false, error: friendlySupabaseError(error?.message ?? 'Insert échoué') };
    }
    episodeId = (inserted as unknown as { id: string }).id;
  }

  // Sync hosts (delete + insert).
  const { error: delErr } = await supabase
    .from('landing_podcast_episode_hosts')
    .delete()
    .eq('episode_id', episodeId);
  if (delErr) return { ok: false, error: delErr.message };

  if (data.host_ids.length > 0) {
    const hostRows = data.host_ids.map((team_member_id, i) => ({
      episode_id: episodeId!,
      team_member_id,
      display_order: i,
    }));
    const { error: insErr } = await supabase
      .from('landing_podcast_episode_hosts')
      .insert(hostRows as never);
    if (insErr) return { ok: false, error: insErr.message };
  }

  revalidate();
  return { ok: true, id: episodeId };
}

export async function deletePodcastEpisode(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createServerClient();
  const { error } = await supabase.from('landing_podcast_episodes').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

function friendlySupabaseError(msg: string): string {
  if (msg.includes('landing_podcast_episodes_slug_key') || msg.includes('duplicate key')) {
    return 'Ce slug est déjà utilisé par un autre épisode.';
  }
  return msg;
}
