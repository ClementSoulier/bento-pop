import { Eyebrow } from '@/components/Eyebrow';
import { EpisodeCard } from '@/components/EpisodeCard';
import { HostAvatar } from '@/components/HostAvatar';
import { SmartImage } from '@/components/SmartImage';
import { BlogContent } from '@/components/blog/BlogContent';
import { Breadcrumbs } from '@/components/blog/BlogChrome';
import { PostCard } from '@/components/blog/PostCard';
import { formatPublishedDate } from '@/lib/episodes';
import type { BlogPost, BlogPostSummary } from '@/content/blog';

/**
 * Corps d'un article, partagé par la page publique et l'aperçu signé : les deux
 * montrent exactement le même rendu.
 */
export function BlogArticle({ post, more }: { post: BlogPost; more: BlogPostSummary[] }) {
  const date = formatPublishedDate(post.publishedAt);
  return (
    <>
      <article className="mx-auto max-w-[760px]">
        <Breadcrumbs
          items={[
            { href: '/', label: 'Accueil' },
            { href: '/blog', label: 'Blog' },
            ...(post.category
              ? [{ href: `/blog/categorie/${post.category.slug}`, label: post.category.name }]
              : []),
            { label: post.title },
          ]}
        />

        <header className="mt-6 mb-8">
          {post.category ? <Eyebrow>{post.category.name}</Eyebrow> : <Eyebrow>Le blog</Eyebrow>}
          <h1 className="font-display mt-3 text-[clamp(34px,5.5vw,60px)] leading-[0.98] text-bento-ink text-balance">
            {post.title}
          </h1>
          {post.excerpt ? (
            <p className="mt-5 text-[20px] leading-[1.5] text-bento-ink/80 text-pretty">{post.excerpt}</p>
          ) : null}
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
            {post.authors.length === 0 ? (
              <span className="text-[15px] font-semibold">Par Bento Pop</span>
            ) : (
              <div className="flex items-center gap-2.5">
                <div className="flex -space-x-2">
                  {post.authors.map((a) => (
                    <HostAvatar key={a.id} photo={a.photo} name={a.name} size="sm" />
                  ))}
                </div>
                <span className="text-[15px] font-semibold">
                  Par{' '}
                  {post.authors.map((a, i) => (
                    <span key={a.id}>
                      {i > 0 ? (i === post.authors.length - 1 ? ' et ' : ', ') : ''}
                      {a.name}
                    </span>
                  ))}
                </span>
              </div>
            )}
            <span className="font-mono text-[12px] uppercase tracking-[0.15em] text-bento-ink/65">
              {date ? (
                <time dateTime={post.publishedAt ?? undefined}>{date}</time>
              ) : null}
              {date ? ' · ' : ''}
              {post.readingMinutes} min de lecture
            </span>
          </div>
        </header>

        {post.coverUrl ? (
          <div className="relative mb-10 aspect-video w-full overflow-hidden rounded-[26px] border-[4px] border-bento-ink bg-bento-cream shadow-stamp-lg">
            <SmartImage
              src={post.coverUrl}
              alt={post.coverAlt}
              fill
              priority
              sizes="(max-width: 800px) 100vw, 760px"
              className="h-full w-full object-cover"
            />
          </div>
        ) : null}

        <BlogContent doc={post.content} />
      </article>

      {post.related.length > 0 ? (
        <section className="mt-16" aria-labelledby="episodes-lies">
          <h2 id="episodes-lies" className="font-display-sm mb-6 text-[28px] text-bento-ink">
            Les épisodes dont on parle
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {post.related.map((e) => (
              <EpisodeCard
                key={`${e.kind}-${e.id}`}
                href={e.kind === 'show' ? `/emissions/${e.slug}` : `/podcasts/${e.slug}`}
                title={e.title}
                season={e.season}
                episodeNumber={e.episodeNumber}
                thumbnailUrl={e.thumbnailUrl}
                youtubeId={e.youtubeId}
                durationSeconds={e.durationSeconds}
                publishedAt={e.publishedAt}
                hosts={[]}
                kind={e.kind}
              />
            ))}
          </div>
        </section>
      ) : null}

      {more.length > 0 ? (
        <section className="mt-16" aria-labelledby="a-lire-aussi">
          <h2 id="a-lire-aussi" className="font-display-sm mb-6 text-[28px] text-bento-ink">
            À lire aussi
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {more.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
