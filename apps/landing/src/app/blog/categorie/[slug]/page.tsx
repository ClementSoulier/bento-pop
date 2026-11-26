import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Nav } from '@/sections/Nav/Nav';
import { Footer } from '@/sections/Footer/Footer';
import { SectionHead } from '@/components/SectionHead';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs, CategoryChips, EmptyBlog } from '@/components/blog/BlogChrome';
import { PostGrid } from '@/components/blog/PostCard';
import { blogBreadcrumbSchema, blogSchema } from '@/lib/seo/blog-structured-data';
import { getBlogCategoriesInUse, getBlogCategory, getBlogPosts } from '@/content/blog';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const [category, posts] = await Promise.all([getBlogCategory(slug), getBlogPosts(slug)]);
  if (!category) return { title: 'Catégorie introuvable', robots: { index: false } };
  const description =
    category.description || `Les articles « ${category.name} » du blog Bento Pop.`;
  return {
    title: `${category.name} · Le blog`,
    description,
    alternates: { canonical: `/blog/categorie/${category.slug}` },
    openGraph: {
      title: `${category.name} · Le blog Bento Pop`,
      description,
      url: `/blog/categorie/${category.slug}`,
    },
    // Une catégorie vide n'a rien à offrir aux moteurs (cf. docs/BLOG.md D4).
    ...(posts.length === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function BlogCategoryPage({ params }: PageProps) {
  const { slug } = await params;
  const [category, posts, categories] = await Promise.all([
    getBlogCategory(slug),
    getBlogPosts(slug),
    getBlogCategoriesInUse(),
  ]);
  if (!category) notFound();

  return (
    <>
      <JsonLd
        data={[
          blogSchema(posts, `${category.name} · Le blog Bento Pop`, `/blog/categorie/${category.slug}`),
          blogBreadcrumbSchema([
            { name: 'Accueil', path: '/' },
            { name: 'Blog', path: '/blog' },
            { name: category.name, path: `/blog/categorie/${category.slug}` },
          ]),
        ]}
      />
      <Nav />
      <main id="main" tabIndex={-1} className="min-h-screen bg-bento-yellow px-5 pt-12 pb-20 md:px-7 md:pt-16">
        <div className="mx-auto max-w-[1180px]">
          <Breadcrumbs
            items={[
              { href: '/', label: 'Accueil' },
              { href: '/blog', label: 'Blog' },
              { label: category.name },
            ]}
          />
          <SectionHead
            eyebrow="Le blog"
            title={category.name}
            description={category.description || undefined}
            align="left"
            className="mt-6"
          />
          <CategoryChips categories={categories} current={category.slug} />
          {posts.length === 0 ? (
            <EmptyBlog>Aucun article dans cette catégorie pour l’instant.</EmptyBlog>
          ) : (
            <PostGrid posts={posts} />
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
