import type { Metadata } from 'next';
import { Nav } from '@/sections/Nav/Nav';
import { Footer } from '@/sections/Footer/Footer';
import { SectionHead } from '@/components/SectionHead';
import { EpisodeCard } from '@/components/EpisodeCard';
import { JsonLd } from '@/components/JsonLd';
import { podcastSeriesSchema } from '@/lib/seo/structured-data';
import { getPodcastEpisodes } from '@/content/episodes';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Podcasts',
  description:
    "Tous les épisodes du podcast Bento Pop. Débriefs pop culture sans filtre : cinéma, gaming, mangas, débats société. Disponible sur Spotify, Apple Podcasts, Deezer.",
  alternates: { canonical: '/podcasts' },
  openGraph: {
    title: 'Podcasts · Bento Pop',
    description:
      'Tous les épisodes du podcast Bento Pop. Débriefs pop culture sans filtre.',
    url: '/podcasts',
  },
};

export default async function PodcastsPage() {
  const episodes = await getPodcastEpisodes();
  return (
    <>
      <JsonLd data={[podcastSeriesSchema()]} />
      <Nav />
      <main id="main" tabIndex={-1} className="min-h-screen bg-bento-yellow px-5 pt-12 pb-20 md:px-7 md:pt-16">
        <div className="mx-auto max-w-[1180px]">
          <SectionHead
            eyebrow="Podcast Bento Pop"
            title="Tous les épisodes"
            description={`Le catalogue complet des débriefs en audio. ${episodes.length} épisode${episodes.length > 1 ? 's' : ''} disponible${episodes.length > 1 ? 's' : ''}.`}
            align="left"
          />
          {episodes.length === 0 ? (
            <div className="rounded-3xl border-[4px] border-bento-ink bg-bento-cream px-8 py-16 text-center shadow-stamp">
              <p className="font-display text-[24px]">Bientôt disponible</p>
              <p className="mt-3 text-[15px] text-bento-ink/70">
                Les premiers épisodes audio arrivent très vite. En attendant, retrouve le podcast sur Spotify.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {episodes.map((ep) => (
                <EpisodeCard
                  key={ep.id}
                  href={`/podcasts/${ep.slug}`}
                  title={ep.title}
                  season={ep.season}
                  episodeNumber={ep.episodeNumber}
                  thumbnailUrl={ep.thumbnailUrl}
                  durationSeconds={ep.durationSeconds}
                  publishedAt={ep.publishedAt}
                  hosts={ep.hosts}
                  kind="podcast"
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
