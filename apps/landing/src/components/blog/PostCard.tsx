import Link from 'next/link';
import { clsx } from '@/lib/clsx';
import { HostAvatar } from '@/components/HostAvatar';
import { SmartImage } from '@/components/SmartImage';
import { formatPublishedDate } from '@/lib/episodes';
import type { BlogPostSummary } from '@/content/blog';

/** Carte d'article : liste du blog, catégorie, « À lire aussi » et bloc de la home. */
export function PostCard({ post, priority = false }: { post: BlogPostSummary; priority?: boolean }) {
  const date = formatPublishedDate(post.publishedAt);
  return (
    <Link
      href={`/blog/${post.slug}`}
      className={clsx(
        'group flex flex-col overflow-hidden rounded-[22px]',
        'border-[4px] border-bento-ink bg-bento-cream',
        'shadow-stamp transition-[transform,box-shadow] duration-150',
        'hover:-translate-y-1 hover:shadow-stamp-lg',
        'active:translate-y-0.5 active:shadow-[0_3px_0_var(--bento-ink)]',
      )}
    >
      <div className="relative aspect-video w-full overflow-hidden border-b-[4px] border-bento-ink bg-bento-yellow">
        {post.coverUrl ? (
          <SmartImage
            src={post.coverUrl}
            alt=""
            fill
            priority={priority}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-display text-[56px] text-bento-ink/80">
            Blog
          </div>
        )}
        {post.category ? (
          <div className="absolute left-3 top-3 rounded-full border-[2px] border-bento-ink bg-bento-yellow px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-bento-ink">
            {post.category.name}
          </div>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="font-display-sm line-clamp-3 text-[19px] leading-[1.15] text-bento-ink">
          {post.title}
        </h3>
        {post.excerpt ? (
          <p className="line-clamp-3 text-[14px] leading-[1.5] text-bento-ink/75">{post.excerpt}</p>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-bento-ink/60">
            {date ? `${date} · ` : ''}
            {post.readingMinutes} min
          </span>
          {post.authors.length > 0 ? (
            <div className="flex -space-x-1.5">
              {post.authors.slice(0, 4).map((a) => (
                <HostAvatar key={a.id} photo={a.photo} name={a.name} size="xs" />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export function PostGrid({ posts }: { posts: BlogPostSummary[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((p, i) => (
        <PostCard key={p.id} post={p} priority={i < 3} />
      ))}
    </div>
  );
}
