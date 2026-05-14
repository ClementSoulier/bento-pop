import type { Metadata } from 'next';
import { Nav } from '@/sections/Nav/Nav';
import { Footer } from '@/sections/Footer/Footer';
import { SectionHead } from '@/components/SectionHead';
import { EpisodeCard } from '@/components/EpisodeCard';
import { JsonLd } from '@/components/JsonLd';
import { tvSeriesSchema } from '@/lib/seo/structured-data';
import { getShowEpisodes } from '@/content/episodes';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Émissions YouTube',
  description:
    "Tous les épisodes du talk-show Bento Pop diffusés sur YouTube : pop culture, cinéma, gaming, mangas, conventions. Animé par Dark Hifus avec Thodalf, Elda et Rob.",
  alternates: { canonical: '/emissions' },
  openGraph: {
    title: 'Émissions YouTube · Bento Pop',
    description:
      'Tous les épisodes du talk-show Bento Pop sur YouTube — pop culture sans filtre.',
    url: '/emissions',
  },
};

export default async function EmissionsPage() {
  const episodes = await getShowEpisodes();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bento-pop.com';
  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Émissions YouTube de Bento Pop',
    numberOfItems: episodes.length,
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    itemListElement: episodes.map((ep, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${siteUrl}/emissions/${ep.slug}`,
      name: ep.title,
    })),
  } as const;
  return (
    <>
      <JsonLd data={[tvSeriesSchema(), itemListSchema]} />
      <Nav />
      <main id="main" tabIndex={-1} className="min-h-screen bg-bento-yellow px-5 pt-12 pb-20 md:px-7 md:pt-16">
        <div className="mx-auto max-w-[1180px]">
          <SectionHead
            eyebrow="Émissions YouTube"
            title="Tous les épisodes"
            description={`Le catalogue complet du talk-show Bento Pop. ${episodes.length} épisode${episodes.length > 1 ? 's' : ''} disponible${episodes.length > 1 ? 's' : ''}.`}
            align="left"
          />
          {episodes.length === 0 ? (
            <div className="rounded-3xl border-[4px] border-bento-ink bg-bento-cream px-8 py-16 text-center shadow-stamp">
              <p className="font-display text-[24px]">Bientôt disponible</p>
              <p className="mt-3 text-[15px] text-bento-ink/70">
                Les premiers épisodes arrivent très vite. En attendant, retrouve la chaîne sur YouTube.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {episodes.map((ep) => (
                <EpisodeCard
                  key={ep.id}
                  href={`/emissions/${ep.slug}`}
                  title={ep.title}
                  season={ep.season}
                  episodeNumber={ep.episodeNumber}
                  thumbnailUrl={ep.thumbnailUrl}
                  youtubeId={ep.youtubeId}
                  durationSeconds={ep.durationSeconds}
                  publishedAt={ep.publishedAt}
                  hosts={ep.hosts}
                  kind="show"
                />
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
