type SpotifyEmbedProps = { showId: string };

export function SpotifyEmbed({ showId }: SpotifyEmbedProps) {
  return (
    <div className="overflow-hidden rounded-2xl border-[5px] border-bento-ink bg-[#121212] shadow-[0_8px_0_var(--bento-ink),0_16px_30px_rgba(0,0,0,0.15)]">
      <iframe
        src={`https://open.spotify.com/embed/show/${showId}?utm_source=generator&theme=0`}
        height={352}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        loading="lazy"
        title="Bento Pop Podcast"
        className="block w-full"
        style={{ border: 0 }}
      />
    </div>
  );
}
