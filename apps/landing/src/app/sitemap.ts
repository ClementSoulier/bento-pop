import type { MetadataRoute } from 'next';
import { getPodcastEpisodes, getShowEpisodes } from '@/content/episodes';
import { bentoPath } from '@/lib/bento/metadata';
import { listFeaturedPseudos } from '@/lib/bento/queries';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://bento-pop.com';
  const now = new Date();

  const [shows, podcasts, featuredBentos] = await Promise.all([
    getShowEpisodes(),
    getPodcastEpisodes(),
    listFeaturedPseudos(),
  ]);

  /**
   * Seuls les bentos mis en avant par l'équipe entrent au sitemap.
   *
   * Les autres sont servis en `noindex` (cf. spec §8) : les lister ici
   * enverrait un signal contradictoire aux moteurs, qui les exploreraient
   * pour découvrir qu'ils ne doivent pas les indexer. Priorité modérée :
   * ce sont des pages de partage, pas le cœur éditorial du site.
   *
   * Une entrée par **bento** depuis le chantier 16, et non par personne : le
   * principal sort à `/u/<pseudo>`, les autres à `/u/<pseudo>/<slug>`.
   * `listFeaturedPseudos` dédoublonne déjà par adresse, faute de quoi deux
   * bentos mis en avant d'un même compte produisaient deux fois la même URL.
   */
  const bentoUrls: MetadataRoute.Sitemap = featuredBentos.map((bento) => ({
    url: `${base}${bentoPath(bento.pseudo, bento.isPrimary ? null : bento.slug)}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.5,
  }));

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
    ...bentoUrls,
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
