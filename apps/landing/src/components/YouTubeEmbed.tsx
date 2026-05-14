type YouTubeEmbedProps = {
  youtubeId: string;
  title: string;
};

export function YouTubeEmbed({ youtubeId, title }: YouTubeEmbedProps) {
  return (
    <div className="overflow-hidden rounded-2xl border-[5px] border-bento-ink bg-bento-ink shadow-[0_8px_0_var(--bento-ink),0_16px_30px_rgba(0,0,0,0.15)]">
      <div className="relative aspect-video w-full">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
          className="absolute inset-0 h-full w-full"
          style={{ border: 0 }}
        />
      </div>
    </div>
  );
}
