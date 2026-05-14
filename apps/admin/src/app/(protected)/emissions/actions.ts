'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { datetimeLocalToIso } from '@/lib/episodes/format';
import { showEpisodeSchema, type ShowEpisodePayload } from '@/lib/episodes/schemas';
import { revalidateLanding } from '@/lib/revalidate-landing';

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

function revalidateAdmin() {
  revalidatePath('/');
  revalidatePath('/emissions');
}

/** Purge le cache SSG/ISR de la landing pour les pages impactées. */
async function revalidateLandingShow(slug: string) {
  await revalidateLanding([`/emissions/${slug}`, '/sitemap.xml']);
}

export async function saveShowEpisode(input: ShowEpisodePayload): Promise<ActionResult> {
  await requireAdmin();
  const parsed = showEpisodeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Champs invalides' };
  }
  const data = parsed.data;
  const supabase = await createServerClient();

  const row = {
    slug: data.slug,
    title: data.title,
    description: data.description ?? '',
    youtube_id: data.youtube_id,
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
      .from('landing_show_episodes')
      .update(row as never)
      .eq('id', episodeId);
    if (error) return { ok: false, error: friendlySupabaseError(error.message) };
  } else {
    const { data: inserted, error } = await supabase
      .from('landing_show_episodes')
      .insert(row as never)
      .select('id')
      .single();
    if (error || !inserted) {
      return { ok: false, error: friendlySupabaseError(error?.message ?? 'Insert échoué') };
    }
    episodeId = (inserted as unknown as { id: string }).id;
  }

  // Sync hosts : delete + insert (simple et atomique pour ces volumes).
  const { error: delErr } = await supabase
    .from('landing_show_episode_hosts')
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
      .from('landing_show_episode_hosts')
      .insert(hostRows as never);
    if (insErr) return { ok: false, error: insErr.message };
  }

  revalidateAdmin();
  await revalidateLandingShow(data.slug);
  return { ok: true, id: episodeId };
}

export async function deleteShowEpisode(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createServerClient();
  // Récupère le slug AVANT delete pour pouvoir purger le cache du slug.
  const { data: row } = await supabase
    .from('landing_show_episodes')
    .select('slug')
    .eq('id', id)
    .maybeSingle();
  const slug = (row as { slug?: string } | null)?.slug ?? null;

  const { error } = await supabase.from('landing_show_episodes').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidateAdmin();
  if (slug) await revalidateLandingShow(slug);
  return { ok: true };
}

function friendlySupabaseError(msg: string): string {
  if (msg.includes('landing_show_episodes_slug_key') || msg.includes('duplicate key')) {
    return 'Ce slug est déjà utilisé par un autre épisode.';
  }
  return msg;
}
