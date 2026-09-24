import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Nav } from '@/sections/Nav/Nav';
import { Footer } from '@/sections/Footer/Footer';
import { Eyebrow } from '@/components/Eyebrow';
import { HostAvatar } from '@/components/HostAvatar';
import { JsonLd } from '@/components/JsonLd';
import { MentionsList } from '@/components/MentionsList';
import { SmartImage } from '@/components/SmartImage';
import { PodcastEpisodeEmbed } from '@/components/PodcastEpisodeEmbed';
import { PodcastPlayer } from '@/components/PodcastPlayer';
import {
  AUDIO_PLATFORM_BRAND,
  isAudioPlatform,
  resolveAudioPlatform,
  type AudioPlatform,
} from '@/lib/podcast-platform';
import { isRealEpisodeId } from '@/lib/podcast-player';
import { formatDurationShort, formatPublishedDate, formatTimecode } from '@/lib/episodes';
import { getDebriefs } from '@/content/debriefs';
import { getPodcastEpisodeBySlug, getPodcastEpisodes } from '@/content/episodes';

export const revalidate = 3600;

export async function generateStaticParams() {
  const episodes = await getPodcastEpisodes();
  return episodes.map((ep) => ({ slug: ep.slug }));
}

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const ep = await getPodcastEpisodeBySlug(slug);
  if (!ep) return { title: 'Épisode introuvable', robots: { index: false } };
  const title = ep.seoTitle ?? ep.title;
  const description =
    ep.seoDescription ??
    (ep.description
      ? ep.description.slice(0, 160)
      : `Épisode ${ep.season}·${ep.episodeNumber ?? ''} du podcast Bento Pop.`);
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
  const platform = resolveAudioPlatform({
    platform: ep.audioPlatform,
    episodeId: ep.audioEpisodeId,
    showId: ep.audioShowId,
  });
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bento-pop.com';
  // « A_REMPLACER » tant que la plateforme n'a pas repris l'épisode : ni lecteur ni lien dessus.
  const episodeIdConnu = isRealEpisodeId(ep.audioPlatform, ep.audioEpisodeId);
  const listenLinks = await getListenLinks(
    ep.audioPlatform,
    episodeIdConnu ? platform.pageUrl : null,
  );

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
    // Notre fichier quand il existe : c'est lui que Google sait lire comme un épisode.
    associatedMedia: ep.audioUrl
      ? { '@type': 'AudioObject', contentUrl: ep.audioUrl, encodingFormat: 'audio/mpeg' }
      : episodeIdConnu
        ? { '@type': 'MediaObject', contentUrl: platform.pageUrl }
        : undefined,
    actor: ep.hosts.map((h) => ({ '@type': 'Person', name: h.name })),
    image: ep.thumbnailUrl ?? undefined,
  } as const;

  // BreadcrumbList : Google attend des URLs absolues dans `item`.
  // En relatif, GSC remonte « URL non valide dans le champ id ».
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${siteUrl}/` },
      { '@type': 'ListItem', position: 2, name: 'Podcasts', item: `${siteUrl}/podcasts` },
      { '@type': 'ListItem', position: 3, name: ep.title, item: `${siteUrl}/podcasts/${ep.slug}` },
    ],
  } as const;

  return (
    <>
      <JsonLd data={[episodeSchema, breadcrumbSchema]} />
      <Nav />
      <main
        id="main"
        tabIndex={-1}
        className="min-h-screen bg-bento-yellow px-5 pt-12 pb-20 md:px-7 md:pt-16"
      >
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

          {ep.audioUrl ? (
            <PodcastPlayer
              src={ep.audioUrl}
              title={ep.title}
              durationSeconds={ep.durationSeconds}
              chapters={ep.chapters}
              artworkUrl={ep.audioImageUrl || ep.thumbnailUrl}
            />
          ) : episodeIdConnu ? (
            <PodcastEpisodeEmbed platform={platform} title={ep.title} />
          ) : null}

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
                    {ep.chapters.map((c, i) => {
                      const contenu = (
                        <>
                          <span className="rounded-md border-[2px] border-bento-ink bg-bento-yellow px-2 py-0.5 font-mono text-[12px] font-bold text-bento-ink group-hover:bg-bento-orange">
                            {formatTimecode(c.start_seconds)}
                          </span>
                          <span className="flex-1 group-hover:underline">{c.label}</span>
                        </>
                      );
                      return (
                        <li key={i}>
                          {/* Avec notre lecteur, un chapitre est un lien vers son instant (voir PodcastPlayer). */}
                          {ep.audioUrl ? (
                            <a
                              href={`#t=${c.start_seconds}`}
                              data-seek={c.start_seconds}
                              className="group flex items-center gap-4 rounded-md py-2.5 text-[15px] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-bento-ink"
                            >
                              {contenu}
                            </a>
                          ) : (
                            <div className="flex items-center gap-4 py-2.5 text-[15px]">
                              {contenu}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              ) : null}

              {ep.mentions.length > 0 ? (
                <Card title="Œuvres mentionnées">
                  <MentionsList mentions={ep.mentions} />
                </Card>
              ) : null}
            </div>

            <aside className="space-y-6">
              {listenLinks.length > 0 ? (
                <Card title={ep.audioUrl ? 'Écouter aussi sur' : 'Écouter sur'}>
                  <ul className="flex flex-wrap gap-2.5">
                    {listenLinks.map((l) => (
                      <li key={l.kind}>
                        <a
                          href={l.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ backgroundColor: l.brandColor }}
                          className="inline-flex items-center gap-2 rounded-full border-[3px] border-bento-ink px-4 pt-2 pb-1.5 font-bold uppercase tracking-[0.08em] text-[13px] text-bento-ink shadow-stamp transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-stamp-lg"
                        >
                          {l.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : null}

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
                          <SmartImage
                            src={g.photo_url}
                            alt=""
                            width={40}
                            height={40}
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

/**
 * Les plateformes où écouter le podcast, telles qu'on les gère dans l'admin (liens
 * « podcast »). Sur la plateforme de la fiche, le lien mène à l'épisode lui-même quand on
 * connaît son identifiant ; sinon, à la page du podcast.
 */
async function getListenLinks(
  platformOfEpisode: AudioPlatform,
  episodePageUrl: string | null,
): Promise<Array<{ kind: AudioPlatform; href: string; label: string; brandColor: string }>> {
  const { platforms } = await getDebriefs();
  const links = platforms.flatMap((p) => {
    if (!isAudioPlatform(p.iconKey) || !p.href || p.href === '#') return [];
    const href = p.iconKey === platformOfEpisode && episodePageUrl ? episodePageUrl : p.href;
    return [{ kind: p.iconKey, href, ...AUDIO_PLATFORM_BRAND[p.iconKey] }];
  });
  if (links.length === 0 && episodePageUrl) {
    return [
      { kind: platformOfEpisode, href: episodePageUrl, ...AUDIO_PLATFORM_BRAND[platformOfEpisode] },
    ];
  }
  return links;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border-[4px] border-bento-ink bg-bento-cream p-5 shadow-stamp">
      <h2 className="font-display-sm mb-3 text-[20px] text-bento-ink">{title}</h2>
      {children}
    </section>
  );
}

function Breadcrumbs({ items }: { items: Array<{ href?: string; label: string }> }) {
  return (
    <nav
      aria-label="Fil d'Ariane"
      className="font-mono text-[11px] uppercase tracking-[0.18em] text-bento-ink/65"
    >
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
      <h2 className="font-display-sm mb-6 text-[28px] text-bento-ink">À écouter aussi</h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {others.map((e) => (
          <Link
            key={e.id}
            href={`/podcasts/${e.slug}`}
            className="group flex gap-3 rounded-xl border-[3px] border-bento-ink bg-bento-cream p-3 shadow-stamp transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-stamp-lg"
          >
            <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-md border-[2px] border-bento-ink bg-[#1ed760]">
              {e.thumbnailUrl ? (
                <SmartImage
                  src={e.thumbnailUrl}
                  alt={e.title}
                  fill
                  sizes="128px"
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
