'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';
import { revalidateLanding } from '@/lib/revalidate-landing';
import { countWords, docPlainText, readingMinutes, validateBlogDoc } from '@/lib/blog/document';
import { buildPreviewUrl } from '@/lib/blog/preview';
import { blogPostSchema, type BlogPostPayload } from '@/lib/blog/schemas';

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

function revalidateAdmin(id?: string) {
  revalidatePath('/');
  revalidatePath('/blog');
  if (id) revalidatePath(`/blog/${id}`);
}

/**
 * Pages de la landing à purger. `/blog`, les catégories et la home sont rendues à
 * chaque requête : seules la page de l'article (ISR), le sitemap et le flux comptent.
 */
async function revalidateLandingPost(...slugs: Array<string | null | undefined>) {
  const paths = new Set<string>(['/sitemap.xml', '/blog/feed.xml']);
  for (const slug of slugs) if (slug) paths.add(`/blog/${slug}`);
  await revalidateLanding([...paths]);
}

export async function savePost(input: BlogPostPayload): Promise<ActionResult> {
  await requireAdmin();
  const parsed = blogPostSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Champs invalides' };
  }
  const data = parsed.data;
  const doc = validateBlogDoc(data.content);
  if (!doc.ok) return { ok: false, error: doc.error };

  const words = countWords(docPlainText(doc.doc));
  /* Publié sans date : la date d'enregistrement fait foi, l'article ne reste pas sans
     date affichée ni place dans le flux. */
  const publishedAt =
    data.published_at || (data.status === 'published' ? new Date().toISOString() : null);
  if (publishedAt && Number.isNaN(Date.parse(publishedAt))) {
    return { ok: false, error: 'Date de publication invalide.' };
  }

  const row = {
    slug: data.slug,
    title: data.title,
    excerpt: data.excerpt,
    content: doc.doc,
    cover_url: data.cover_url || null,
    cover_alt: data.cover_alt,
    category_id: data.category_id || null,
    status: data.status,
    published_at: publishedAt,
    seo_title: data.seo_title || null,
    seo_description: data.seo_description || null,
    word_count: words,
    reading_minutes: readingMinutes(words),
  };

  const supabase = await createServerClient();
  let postId = data.id;
  let previousSlug: string | null = null;

  if (postId) {
    const { data: before } = await supabase
      .from('landing_blog_posts')
      .select('slug')
      .eq('id', postId)
      .maybeSingle();
    previousSlug = (before as { slug?: string } | null)?.slug ?? null;
    const { error } = await supabase
      .from('landing_blog_posts')
      .update(row as never)
      .eq('id', postId);
    if (error) return { ok: false, error: friendlyError(error.message) };
  } else {
    const { data: inserted, error } = await supabase
      .from('landing_blog_posts')
      .insert(row as never)
      .select('id')
      .single();
    if (error || !inserted) {
      return { ok: false, error: friendlyError(error?.message ?? 'Création échouée') };
    }
    postId = (inserted as unknown as { id: string }).id;
  }

  // Auteurs et épisodes liés : effacer puis réécrire, comme les animateurs des épisodes.
  const { error: delAuthors } = await supabase
    .from('landing_blog_post_authors')
    .delete()
    .eq('post_id', postId);
  if (delAuthors) return { ok: false, error: delAuthors.message };
  if (data.author_ids.length > 0) {
    const { error } = await supabase.from('landing_blog_post_authors').insert(
      data.author_ids.map((team_member_id, i) => ({
        post_id: postId!,
        team_member_id,
        display_order: i,
      })) as never,
    );
    if (error) return { ok: false, error: error.message };
  }

  const { error: delRelated } = await supabase
    .from('landing_blog_post_episodes')
    .delete()
    .eq('post_id', postId);
  if (delRelated) return { ok: false, error: delRelated.message };
  const related = dedupeRelated(data.related);
  if (related.length > 0) {
    const { error } = await supabase.from('landing_blog_post_episodes').insert(
      related.map((r, i) => ({
        post_id: postId!,
        show_episode_id: r.kind === 'show' ? r.id : null,
        podcast_episode_id: r.kind === 'podcast' ? r.id : null,
        display_order: i,
      })) as never,
    );
    if (error) return { ok: false, error: error.message };
  }

  revalidateAdmin(postId);
  await revalidateLandingPost(data.slug, previousSlug);
  return { ok: true, id: postId };
}

export async function deletePost(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createServerClient();
  const { data: row } = await supabase
    .from('landing_blog_posts')
    .select('slug')
    .eq('id', id)
    .maybeSingle();
  const slug = (row as { slug?: string } | null)?.slug ?? null;

  const { error } = await supabase.from('landing_blog_posts').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidateAdmin();
  await revalidateLandingPost(slug);
  return { ok: true };
}

/** Lien signé vers l'aperçu de l'article sur la landing, valable 24 h. */
export async function getPreviewLink(
  id: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireAdmin();
  const landing = process.env.LANDING_URL;
  const secret = process.env.REVALIDATE_TOKEN;
  if (!landing || !secret) {
    return { ok: false, error: 'Aperçu indisponible : LANDING_URL ou REVALIDATE_TOKEN manquant.' };
  }
  return { ok: true, url: buildPreviewUrl(landing, id, secret) };
}

function dedupeRelated<T extends { kind: string; id: string }>(list: T[]): T[] {
  const seen = new Set<string>();
  return list.filter((r) => {
    const key = `${r.kind}:${r.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function friendlyError(msg: string): string {
  if (msg.includes('landing_blog_posts_slug_key') || msg.includes('duplicate key')) {
    return 'Ce slug est déjà utilisé par un autre article.';
  }
  return msg;
}
