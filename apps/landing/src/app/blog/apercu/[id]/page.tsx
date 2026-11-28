import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Nav } from '@/sections/Nav/Nav';
import { Footer } from '@/sections/Footer/Footer';
import { BlogArticle } from '@/components/blog/BlogArticle';
import { verifyPreview } from '@/lib/blog/preview';
import { getBlogPostForPreview } from '@/content/blog';

/**
 * Aperçu d'un article non publié, par lien signé du BO (docs/BLOG.md D12). Jamais
 * indexé, jamais mis en cache : chaque ouverture relit l'article en base.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Aperçu d’article',
  robots: { index: false, follow: false, nocache: true },
};

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ exp?: string | string[]; sig?: string | string[] }>;
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function BlogPreviewPage({ params, searchParams }: PageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!verifyPreview(id, first(query.exp), first(query.sig), process.env.REVALIDATE_TOKEN)) {
    notFound();
  }
  const post = await getBlogPostForPreview(id);
  if (!post) notFound();

  return (
    <>
      <Nav />
      <div
        role="status"
        className="border-b-[3px] border-bento-ink bg-bento-red px-5 py-2 text-center font-mono text-[12px] font-bold uppercase tracking-[0.15em] text-bento-cream"
      >
        Aperçu · cette page n’est pas publique, le lien expire sous 24 h
      </div>
      <main id="main" tabIndex={-1} className="min-h-screen bg-bento-yellow px-5 pt-12 pb-20 md:px-7 md:pt-16">
        <div className="mx-auto max-w-[1180px]">
          <BlogArticle post={post} more={[]} />
        </div>
      </main>
      <Footer />
    </>
  );
}
