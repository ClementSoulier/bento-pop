import type { ResolvedPlatform } from '@/lib/podcast-platform';

type PodcastEpisodeEmbedProps = {
  platform: ResolvedPlatform;
  title: string;
};

export function PodcastEpisodeEmbed({ platform, title }: PodcastEpisodeEmbedProps) {
  return (
    <div className="overflow-hidden rounded-2xl border-[5px] border-bento-ink bg-[#121212] shadow-[0_8px_0_var(--bento-ink),0_16px_30px_rgba(0,0,0,0.15)]">
      <iframe
        src={platform.embedUrl}
        height={platform.embedHeight}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        title={title}
        className="block w-full"
        style={{ border: 0 }}
      />
    </div>
  );
}
