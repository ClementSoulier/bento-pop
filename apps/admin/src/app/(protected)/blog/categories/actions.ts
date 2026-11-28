'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';
import { revalidateLanding } from '@/lib/revalidate-landing';
import { blogCategorySchema, type BlogCategoryPayload } from '@/lib/blog/schemas';

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

/**
 * Le nom de la catégorie s'affiche sur chaque article : on purge les pages des
 * articles qui la portent. Les listes et pages de catégorie sont rendues à la requête.
 */
async function postPathsOf(categoryId: string): Promise<string[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from('landing_blog_posts')
    .select('slug')
    .eq('category_id', categoryId);
  return ((data ?? []) as Array<{ slug: string }>).map((p) => `/blog/${p.slug}`);
}

async function revalidatePosts(paths: string[]) {
  await revalidateLanding([...paths, '/sitemap.xml', '/blog/feed.xml']);
}

export async function saveCategory(input: BlogCategoryPayload): Promise<ActionResult> {
  await requireAdmin();
  const parsed = blogCategorySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Champs invalides' };
  }
  const { id, ...row } = parsed.data;
  const supabase = await createServerClient();

  let categoryId = id;
  if (categoryId) {
    const { error } = await supabase
      .from('landing_blog_categories')
      .update(row as never)
      .eq('id', categoryId);
    if (error) return { ok: false, error: friendlyError(error.message) };
  } else {
    const { data, error } = await supabase
      .from('landing_blog_categories')
      .insert(row as never)
      .select('id')
      .single();
    if (error || !data) return { ok: false, error: friendlyError(error?.message ?? 'Création échouée') };
    categoryId = (data as unknown as { id: string }).id;
  }

  revalidatePath('/blog');
  revalidatePath('/blog/categories');
  await revalidatePosts(await postPathsOf(categoryId));
  return { ok: true, id: categoryId };
}

/** Les articles de la catégorie restent, sans catégorie (`on delete set null`). */
export async function deleteCategory(id: string): Promise<ActionResult> {
  await requireAdmin();
  // Liste relevée avant la suppression, tant que les articles portent encore la catégorie.
  const paths = await postPathsOf(id);
  const supabase = await createServerClient();
  const { error } = await supabase.from('landing_blog_categories').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/blog');
  revalidatePath('/blog/categories');
  await revalidatePosts(paths);
  return { ok: true };
}

function friendlyError(msg: string): string {
  if (msg.includes('landing_blog_categories_slug_key') || msg.includes('duplicate key')) {
    return 'Ce slug est déjà utilisé par une autre catégorie.';
  }
  return msg;
}
