import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Nav } from '@/sections/Nav/Nav';
import { Footer } from '@/sections/Footer/Footer';
import { Eyebrow } from '@/components/Eyebrow';
import { HostAvatar } from '@/components/HostAvatar';
import { JsonLd } from '@/components/JsonLd';
import { SpotifyEpisodeEmbed } from '@/components/SpotifyEpisodeEmbed';
import {
  formatDurationShort,
  formatPublishedDate,
  formatTimecode,
  MENTION_TYPE_LABELS,
} from '@/lib/episodes';
import { getPodcastEpisodeBySlug, getPodcastEpisodes } from '@/content/episodes';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const ep = await getPodcastEpisodeBySlug(slug);
  if (!ep) return { title: 'Épisode introuvable', robots: { index: false } };
  const title = ep.seoTitle ?? ep.title;
  const description =
    ep.seoDescription ??
    (ep.description ? ep.description.slice(0, 160) : `Épisode ${ep.season}·${ep.episodeNumber ?? ''} du podcast Bento Pop.`);
  return {
    title,
    description,
    alternates: { canonical: `/podcasts/${ep.slug}` },
    openGraph: {
      type: 'article',
      title,
      description,
      url: `/podcasts/${ep.slug}`,
      images: ep.thumbnailUrl ? [{ url: ep.thumbnailUrl, alt: ep.title }] : undefined,
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function PodcastEpisodeDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const ep = await getPodcastEpisodeBySlug(slug);
  if (!ep) notFound();

  const datePublished = ep.publishedAt ? new Date(ep.publishedAt).toISOString() : undefined;
  const spotifyUrl = `https://open.spotify.com/episode/${ep.spotifyEpisodeId}`;

  const episodeSchema = {
    '@context': 'https://schema.org',
    '@type': 'PodcastEpisode',
    name: ep.title,
    description: ep.description || ep.seoDescription || undefined,
    episodeNumber: ep.episodeNumber ?? undefined,
    partOfSeason: { '@type': 'PodcastSeason', seasonNumber: ep.season },
    partOfSeries: {
      '@type': 'PodcastSeries',
      name: 'Bento Pop · Les Débriefs',
    },
    datePublished,
    inLanguage: 'fr-FR',
    duration: ep.durationSeconds ? `PT${ep.durationSeconds}S` : undefined,
    associatedMedia: {
      '@type': 'MediaObject',
      contentUrl: spotifyUrl,
    },
    actor: ep.hosts.map((h) => ({ '@type': 'Person', name: h.name })),
    image: ep.thumbnailUrl ?? undefined,
  } as const;

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: '/' },
      { '@type': 'ListItem', position: 2, name: 'Podcasts', item: '/podcasts' },
      { '@type': 'ListItem', position: 3, name: ep.title, item: `/podcasts/${ep.slug}` },
    ],
  } as const;

  return (
    <>
      <JsonLd data={[episodeSchema, breadcrumbSchema]} />
      <Nav />
      <main id="main" tabIndex={-1} className="min-h-screen bg-bento-yellow px-5 pt-12 pb-20 md:px-7 md:pt-16">
        <div className="mx-auto max-w-[1180px]">
          <Breadcrumbs
            items={[
              { href: '/', label: 'Accueil' },
              { href: '/podcasts', label: 'Podcasts' },
              { label: ep.title },
            ]}
          />

          <header className="mt-6 mb-8">
            <Eyebrow>
              Saison {ep.season}
              {ep.episodeNumber != null ? ` · Épisode ${ep.episodeNumber}` : ''}
            </Eyebrow>
            <h1 className="font-display mt-3 text-[clamp(32px,5vw,56px)] text-bento-ink">
              {ep.title}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[12px] uppercase tracking-[0.15em] text-bento-ink/70">
              {ep.publishedAt ? <span>{formatPublishedDate(ep.publishedAt)}</span> : null}
              {ep.durationSeconds ? <span>· {formatDurationShort(ep.durationSeconds)}</span> : null}
              {ep.hosts.length > 0 ? (
                <span>· {ep.hosts.map((h) => h.name).join(' · ')}</span>
              ) : null}
            </div>
          </header>

          <SpotifyEpisodeEmbed spotifyEpisodeId={ep.spotifyEpisodeId} title={ep.title} />

          <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-10">
              {ep.description ? (
                <Card title="À propos">
                  <p className="whitespace-pre-line text-[16px] leading-[1.6] text-bento-ink/85">
                    {ep.description}
                  </p>
                </Card>
              ) : null}

              {ep.chapters.length > 0 ? (
                <Card title="Chapitres">
                  <ul className="divide-y divide-bento-ink/10">
                    {ep.chapters.map((c, i) => (
                      <li key={i} className="flex items-center gap-4 py-2.5 text-[15px]">
                        <span className="rounded-md border-[2px] border-bento-ink bg-bento-yellow px-2 py-0.5 font-mono text-[12px] font-bold text-bento-ink">
                          {formatTimecode(c.start_seconds)}
                        </span>
                        <span className="flex-1">{c.label}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : null}

              {ep.mentions.length > 0 ? (
                <Card title="Œuvres mentionnées">
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {ep.mentions.map((m, i) => {
                      const inner = (
                        <>
                          <span className="rounded-full border-[2px] border-bento-ink bg-bento-cream px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-bento-ink/70">
                            {MENTION_TYPE_LABELS[m.type] ?? m.type}
                          </span>
                          <span className="flex-1 text-[14px] font-semibold">{m.title}</span>
                        </>
                      );
                      return (
                        <li key={i}>
                          {m.url ? (
                            <a
                              href={m.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 rounded-xl border-[2px] border-bento-ink/15 bg-bento-cream/60 p-3 transition-colors hover:border-bento-ink hover:bg-bento-cream"
                            >
                              {inner}
                            </a>
                          ) : (
                            <div className="flex items-center gap-3 rounded-xl border-[2px] border-bento-ink/15 bg-bento-cream/60 p-3">
                              {inner}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              ) : null}
            </div>

            <aside className="space-y-6">
              <Card title="Écouter">
                <a
                  href={spotifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border-[3px] border-bento-ink bg-[#1ed760] px-4 pt-2 pb-1.5 font-bold uppercase tracking-[0.08em] text-[13px] text-bento-ink shadow-stamp transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-stamp-lg"
                >
                  Ouvrir sur Spotify
                </a>
              </Card>

              {ep.hosts.length > 0 ? (
                <Card title="Animateurs">
                  <ul className="space-y-2.5">
                    {ep.hosts.map((h) => (
                      <li key={h.id} className="flex items-center gap-3">
                        <HostAvatar photo={h.photo} name={h.name} size="md" />
                        <div>
                          <div className="text-[15px] font-semibold leading-tight">{h.name}</div>
                          <div className="font-nick text-[13px] text-bento-ink/65 leading-tight">
                            {h.nick}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : null}

              {ep.guests.length > 0 ? (
                <Card title={`Invité${ep.guests.length > 1 ? 's' : ''}`}>
                  <ul className="space-y-3">
                    {ep.guests.map((g, i) => (
                      <li key={i} className="flex items-center gap-3">
                        {g.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={g.photo_url}
                            alt=""
                            className="h-10 w-10 rounded-full border-[3px] border-bento-ink object-cover"
                          />
                        ) : (
                          <span className="grid h-10 w-10 place-items-center rounded-full border-[3px] border-bento-ink bg-bento-pink font-mono text-[12px] font-bold text-bento-ink">
                            {g.name.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                        <div>
                          <div className="text-[15px] font-semibold leading-tight">{g.name}</div>
                          {g.role ? (
                            <div className="text-[12px] text-bento-ink/65 leading-tight">
                              {g.role}
                            </div>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : null}
            </aside>
          </div>

          <RelatedPodcastEpisodes currentSlug={ep.slug} />
        </div>
      </main>
      <Footer />
    </>
  );
}

// ============================================================
// Sub-blocks
// ============================================================

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border-[4px] border-bento-ink bg-bento-cream p-5 shadow-stamp">
      <h2 className="font-display mb-3 text-[20px] text-bento-ink">{title}</h2>
      {children}
    </section>
  );
}

function Breadcrumbs({
  items,
}: {
  items: Array<{ href?: string; label: string }>;
}) {
  return (
    <nav aria-label="Fil d'Ariane" className="font-mono text-[11px] uppercase tracking-[0.18em] text-bento-ink/65">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i}>
            {item.href && !isLast ? (
              <Link href={item.href} className="hover:text-bento-ink">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'text-bento-ink' : ''}>{item.label}</span>
            )}
            {!isLast ? <span className="mx-2">/</span> : null}
          </span>
        );
      })}
    </nav>
  );
}

async function RelatedPodcastEpisodes({ currentSlug }: { currentSlug: string }) {
  const all = await getPodcastEpisodes();
  const others = all.filter((e) => e.slug !== currentSlug).slice(0, 3);
  if (others.length === 0) return null;
  return (
    <section className="mt-16">
      <h2 className="font-display mb-6 text-[28px] text-bento-ink">À écouter aussi</h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {others.map((e) => (
          <Link
            key={e.id}
            href={`/podcasts/${e.slug}`}
            className="group flex gap-3 rounded-xl border-[3px] border-bento-ink bg-bento-cream p-3 shadow-stamp transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-stamp-lg"
          >
            <div className="aspect-video w-32 shrink-0 overflow-hidden rounded-md border-[2px] border-bento-ink bg-[#1ed760]">
              {e.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={e.thumbnailUrl}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-bento-cream text-[28px]">
                  🎙
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-bento-ink/60">
                S{e.season}
                {e.episodeNumber != null ? ` · E${e.episodeNumber}` : ''}
              </div>
              <div className="line-clamp-2 text-[14px] font-semibold leading-snug">{e.title}</div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
