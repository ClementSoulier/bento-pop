/**
 * Flux RSS du blog, à https://bento-pop.com/blog/feed.xml (docs/BLOG.md D9).
 * À ne pas confondre avec `/feed.xml`, le flux du podcast.
 *
 * Cache court, comme le flux du podcast : un article programmé y entre à son heure,
 * sans tâche planifiée.
 */
import { getBlogPosts } from '@/content/blog';
import { buildBlogFeed } from '@/lib/blog/feed';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://bento-pop.com';
  const posts = await getBlogPosts(null, 50);
  const xml = buildBlogFeed(
    site,
    posts.map((p) => ({
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt,
      publishedAt: p.publishedAt,
      updatedAt: p.updatedAt,
      category: p.category?.name ?? null,
      authors: p.authors.map((a) => a.name),
    })),
  );
  return new Response(xml, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
