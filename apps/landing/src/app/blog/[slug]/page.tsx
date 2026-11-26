import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Nav } from '@/sections/Nav/Nav';
import { Footer } from '@/sections/Footer/Footer';
import { JsonLd } from '@/components/JsonLd';
import { BlogArticle } from '@/components/blog/BlogArticle';
import { blogBreadcrumbSchema, blogPostingSchema } from '@/lib/seo/blog-structured-data';
import { getBlogPostBySlug, getBlogPosts, getRelatedPosts } from '@/content/blog';

/* ISR d'une heure, purgée par le BO à chaque enregistrement (docs/BLOG.md D9). */
export const revalidate = 3600;

export async function generateStaticParams() {
  const posts = await getBlogPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  if (!post) return { title: 'Article introuvable', robots: { index: false } };
  const title = post.seoTitle || post.title;
  const description = post.seoDescription || post.excerpt.slice(0, 200) || undefined;
  const images = post.coverUrl
    ? [{ url: post.coverUrl, width: 1600, height: 900, alt: post.coverAlt || post.title }]
    : undefined;
  return {
    title,
    description,
    alternates: {
      canonical: `/blog/${post.slug}`,
      types: { 'application/rss+xml': [{ url: '/blog/feed.xml', title: 'Le blog Bento Pop' }] },
    },
    authors: post.authors.map((a) => ({ name: a.name })),
    openGraph: {
      type: 'article',
      title,
      description,
      url: `/blog/${post.slug}`,
      publishedTime: post.publishedAt ?? undefined,
      modifiedTime: post.updatedAt,
      section: post.category?.name,
      authors: post.authors.map((a) => a.name),
      ...(images ? { images } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(post.coverUrl ? { images: [post.coverUrl] } : {}),
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  if (!post) notFound();
  const more = await getRelatedPosts(post);

  return (
    <>
      <JsonLd
        data={[
          blogPostingSchema(post),
          blogBreadcrumbSchema([
            { name: 'Accueil', path: '/' },
            { name: 'Blog', path: '/blog' },
            ...(post.category
              ? [{ name: post.category.name, path: `/blog/categorie/${post.category.slug}` }]
              : []),
            { name: post.title, path: `/blog/${post.slug}` },
          ]),
        ]}
      />
      <Nav />
      <main id="main" tabIndex={-1} className="min-h-screen bg-bento-yellow px-5 pt-12 pb-20 md:px-7 md:pt-16">
        <div className="mx-auto max-w-[1180px]">
          <BlogArticle post={post} more={more} />
        </div>
      </main>
      <Footer />
    </>
  );
}
