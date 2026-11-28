import Link from 'next/link';
import { PageShell } from '@/components/AppShell/PageShell';
import { createServerClient } from '@/lib/supabase/server';
import { CategoriesClient, type CategoryRow } from './CategoriesClient';

export const dynamic = 'force-dynamic';

export default async function BlogCategoriesPage() {
  const supabase = await createServerClient();
  const [categoriesRes, postsRes] = await Promise.all([
    supabase
      .from('landing_blog_categories')
      .select('id, slug, name, description, display_order')
      .order('display_order', { ascending: true })
      .order('name', { ascending: true }),
    supabase.from('landing_blog_posts').select('category_id'),
  ]);

  const counts = new Map<string, number>();
  for (const p of (postsRes.data ?? []) as Array<{ category_id: string | null }>) {
    if (p.category_id) counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1);
  }
  const categories: CategoryRow[] = (
    (categoriesRes.data ?? []) as Array<Omit<CategoryRow, 'post_count'>>
  ).map((c) => ({ ...c, post_count: counts.get(c.id) ?? 0 }));

  return (
    <PageShell
      crumbs={`Blog · ${categories.length} catégorie${categories.length > 1 ? 's' : ''}`}
      title="Catégories du blog"
      actions={
        <Link href="/blog" className="admin-btn">
          ← Articles
        </Link>
      }
    >
      <CategoriesClient categories={categories} />
    </PageShell>
  );
}
