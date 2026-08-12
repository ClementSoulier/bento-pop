export const AUDIO_PLATFORMS = ['spotify', 'deezer', 'apple'] as const;
export type AudioPlatform = (typeof AUDIO_PLATFORMS)[number];

export function isAudioPlatform(value: unknown): value is AudioPlatform {
  return typeof value === 'string' && (AUDIO_PLATFORMS as readonly string[]).includes(value);
}

type ResolveInput = {
  platform: AudioPlatform;
  episodeId: string;
  showId: string;
};

export type ResolvedPlatform = {
  label: string;
  /** Couleur de marque, utilisée pour le bouton « Écouter ». */
  brandColor: string;
  /** URL du lecteur embarqué. */
  embedUrl: string;
  /** URL publique de l'épisode, aussi utilisée dans le JSON-LD. */
  pageUrl: string;
  embedHeight: number;
};

export function resolveAudioPlatform({
  platform,
  episodeId,
  showId,
}: ResolveInput): ResolvedPlatform {
  const id = encodeURIComponent(episodeId);

  switch (platform) {
    case 'deezer':
      return {
        label: 'Deezer',
        brandColor: '#a238ff',
        embedUrl: `https://widget.deezer.com/widget/dark/episode/${id}?app_id=1`,
        pageUrl: `https://www.deezer.com/episode/${id}`,
        embedHeight: 232,
      };

    case 'apple':
      return {
        label: 'Apple Podcasts',
        brandColor: '#d56dfb',
        // L'embed Apple a besoin de l'émission ; l'épisode passe en `?i=`.
        embedUrl: `https://embed.podcasts.apple.com/fr/podcast/id${encodeURIComponent(showId)}?i=${id}`,
        pageUrl: `https://podcasts.apple.com/fr/podcast/id${encodeURIComponent(showId)}?i=${id}`,
        embedHeight: 175,
      };

    case 'spotify':
    default:
      return {
        label: 'Spotify',
        brandColor: '#1ed760',
        embedUrl: `https://open.spotify.com/embed/episode/${id}?utm_source=generator&theme=0`,
        pageUrl: `https://open.spotify.com/episode/${id}`,
        embedHeight: 232,
      };
  }
}
