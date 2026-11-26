import Link from 'next/link';
import { PageShell } from '@/components/AppShell/PageShell';
import { PlusIcon } from '@/components/icons';
import { createServerClient } from '@/lib/supabase/server';
import { BlogListClient, type BlogListRow } from './BlogListClient';

export const dynamic = 'force-dynamic';

export default async function BlogPage() {
  const supabase = await createServerClient();

  const [postsRes, authorsRes, teamRes, categoriesRes] = await Promise.all([
    supabase
      .from('landing_blog_posts')
      .select('id, slug, title, status, published_at, updated_at, category_id, reading_minutes')
      .order('published_at', { ascending: false, nullsFirst: true })
      .order('updated_at', { ascending: false }),
    supabase
      .from('landing_blog_post_authors')
      .select('post_id, team_member_id, display_order')
      .order('display_order', { ascending: true }),
    supabase.from('landing_team').select('id, name'),
    supabase.from('landing_blog_categories').select('id, name'),
  ]);

  // `name` porte le pseudo (« Dark Hifus ») ; `nick` est le rôle (« Le Captain »).
  const nameById = new Map(
    ((teamRes.data ?? []) as Array<{ id: string; name: string }>).map((m) => [m.id, m.name]),
  );
  const categoryById = new Map(
    ((categoriesRes.data ?? []) as Array<{ id: string; name: string }>).map((c) => [c.id, c.name]),
  );
  const authorsByPost = new Map<string, string[]>();
  for (const a of (authorsRes.data ?? []) as Array<{ post_id: string; team_member_id: string }>) {
    const list = authorsByPost.get(a.post_id) ?? [];
    list.push(nameById.get(a.team_member_id) ?? '?');
    authorsByPost.set(a.post_id, list);
  }

  type Raw = Omit<BlogListRow, 'authors' | 'category'> & { category_id: string | null };
  const posts: BlogListRow[] = ((postsRes.data ?? []) as unknown as Raw[]).map((p) => ({
    ...p,
    authors: authorsByPost.get(p.id) ?? [],
    category: p.category_id ? (categoryById.get(p.category_id) ?? null) : null,
  }));

  return (
    <PageShell
      crumbs={`Blog · ${posts.length} article${posts.length > 1 ? 's' : ''}`}
      title="Blog"
      actions={
        <>
          <Link href="/blog/categories" className="admin-btn">
            Catégories
          </Link>
          <Link href="/blog/nouveau" className="admin-btn admin-btn-primary">
            <PlusIcon />
            Nouvel article
          </Link>
        </>
      }
    >
      <BlogListClient posts={posts} landingUrl={process.env.LANDING_URL ?? null} />
    </PageShell>
  );
}
