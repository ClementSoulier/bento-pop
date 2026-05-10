import { cache } from 'react';
import type { DebriefsContent, Platform } from '@/lib/content/schemas';
import { loadEnabledLinks, pickBySurface, type LinkRecord } from '@/lib/content/links';

const STATIC_FALLBACK: DebriefsContent = {
  eyebrow: 'Les Débriefs',
  title: 'Le Bento dans tes oreilles',
  description:
    "Pas le temps de voir l'émission ? Écoutez nos débriefs sans filtre sur la route, dans le métro, ou en faisant la vaisselle. Tous les épisodes sont aussi en podcast.",
  platforms: [
    { id: 'spotify', label: 'Spotify',         href: 'https://open.spotify.com/show/0HmT9Na37Ujd3pvTl4to89', iconKey: 'spotify' },
    { id: 'youtube', label: 'YouTube',         href: 'https://www.youtube.com/@BentoPop.Officiel',           iconKey: 'youtube' },
    { id: 'deezer',  label: 'Deezer',          href: '#',                                                    iconKey: 'deezer'  },
    { id: 'apple',   label: 'Apple Podcasts',  href: '#',                                                    iconKey: 'apple'   },
  ],
  spotifyShowId: '0HmT9Na37Ujd3pvTl4to89',
};

const PLATFORM_ICON: Record<string, Platform['iconKey']> = {
  spotify: 'spotify',
  youtube: 'youtube',
  deezer: 'deezer',
  apple: 'apple',
};

function toPlatform(record: LinkRecord): Platform | null {
  const iconKey = PLATFORM_ICON[record.kind];
  if (!iconKey) return null;
  return {
    id: record.id,
    label: record.name,
    href: record.url || '#',
    iconKey,
  };
}

export const getDebriefs = cache(async (): Promise<DebriefsContent> => {
  const links = await loadEnabledLinks();
  if (!links) return STATIC_FALLBACK;

  const platforms = pickBySurface(links, 'podcast')
    .map(toPlatform)
    .filter((p): p is Platform => p !== null);

  return {
    ...STATIC_FALLBACK,
    platforms: platforms.length > 0 ? platforms : STATIC_FALLBACK.platforms,
  };
});
