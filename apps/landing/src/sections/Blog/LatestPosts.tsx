import Link from 'next/link';
import { SectionHead } from '@/components/SectionHead';
import { PostCard } from '@/components/blog/PostCard';
import { getBlogPosts } from '@/content/blog';

/**
 * Bloc « Derniers articles » de la home (docs/BLOG.md D10). Fond jaune entre Agenda
 * (crème) et Le Thermomètre (noir), pour garder l'alternance des sections. Masqué
 * tant qu'aucun article n'est en ligne.
 */
export async function LatestPosts() {
  const posts = await getBlogPosts(null, 3);
  if (posts.length === 0) return null;
  return (
    <section id="blog" aria-labelledby="blog-titre" className="bg-bento-yellow px-7 py-[90px]">
      <div className="mx-auto max-w-[1180px]">
        <SectionHead
          eyebrow="Le blog"
          title={<span id="blog-titre">Derniers articles</span>}
          description="Dossiers, critiques et coulisses, écrits par la team."
        />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 rounded-full border-[3px] border-bento-ink bg-bento-cream px-6 pt-2.5 pb-2 font-bold uppercase tracking-[0.08em] text-[14px] text-bento-ink shadow-stamp transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-stamp-lg active:translate-y-0.5"
          >
            Tous les articles →
          </Link>
        </div>
      </div>
    </section>
  );
}
