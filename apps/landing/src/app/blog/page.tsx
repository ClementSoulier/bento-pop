import type { Metadata } from 'next';
import { Nav } from '@/sections/Nav/Nav';
import { Footer } from '@/sections/Footer/Footer';
import { SectionHead } from '@/components/SectionHead';
import { JsonLd } from '@/components/JsonLd';
import { CategoryChips, EmptyBlog } from '@/components/blog/BlogChrome';
import { PostGrid } from '@/components/blog/PostCard';
import { blogSchema } from '@/lib/seo/blog-structured-data';
import { getBlogCategoriesInUse, getBlogPosts } from '@/content/blog';

// Comme /emissions : rendu à chaque requête, un article programmé paraît à son heure.
export const dynamic = 'force-dynamic';

const DESCRIPTION =
  'Les articles de la team Bento Pop : actus pop culture, dossiers, critiques de films, séries, mangas et jeux vidéo, coulisses des émissions et des conventions.';

export const metadata: Metadata = {
  title: 'Le blog',
  description: DESCRIPTION,
  alternates: {
    canonical: '/blog',
    types: { 'application/rss+xml': [{ url: '/blog/feed.xml', title: 'Le blog Bento Pop' }] },
  },
  openGraph: { title: 'Le blog · Bento Pop', description: DESCRIPTION, url: '/blog' },
};

export default async function BlogIndexPage() {
  const [posts, categories] = await Promise.all([getBlogPosts(), getBlogCategoriesInUse()]);
  return (
    <>
      <JsonLd data={blogSchema(posts)} />
      <Nav />
      <main id="main" tabIndex={-1} className="min-h-screen bg-bento-yellow px-5 pt-12 pb-20 md:px-7 md:pt-16">
        <div className="mx-auto max-w-[1180px]">
          <SectionHead
            eyebrow="Le blog"
            title="Ça parle pop culture"
            description="Dossiers, critiques, actus et coulisses, écrits par la team Bento Pop."
            align="left"
          />
          <CategoryChips categories={categories} current={null} />
          {posts.length === 0 ? (
            <EmptyBlog>Les premiers articles arrivent très vite. En attendant, retrouve nos émissions.</EmptyBlog>
          ) : (
            <PostGrid posts={posts} />
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
