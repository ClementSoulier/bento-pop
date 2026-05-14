import type { MetadataRoute } from 'next';
import { getPodcastEpisodes, getShowEpisodes } from '@/content/episodes';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://bento-pop.com';
  const now = new Date();

  const [shows, podcasts] = await Promise.all([getShowEpisodes(), getPodcastEpisodes()]);

  const showUrls: MetadataRoute.Sitemap = shows.map((e) => ({
    url: `${base}/emissions/${e.slug}`,
    lastModified: e.publishedAt ? new Date(e.publishedAt) : now,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  const podcastUrls: MetadataRoute.Sitemap = podcasts.map((e) => ({
    url: `${base}/podcasts/${e.slug}`,
    lastModified: e.publishedAt ? new Date(e.publishedAt) : now,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  return [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${base}/emissions`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${base}/podcasts`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    ...showUrls,
    ...podcastUrls,
    {
      url: `${base}/mentions-legales`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${base}/confidentialite`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}
