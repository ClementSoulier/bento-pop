import { getDebriefs } from '@/content/debriefs';
import { Eyebrow } from '@/components/Eyebrow';
import { PlatformPill } from './PlatformPill';
import { SpotifyEmbed } from './SpotifyEmbed';

export async function Debriefs() {
  const { eyebrow, title, description, platforms, spotifyShowId } = await getDebriefs();
  return (
    <section
      id="debriefs"
      className="border-y-[5px] border-bento-ink bg-bento-cream px-7 py-[90px]"
    >
      <div className="mx-auto grid max-w-[1180px] items-center gap-12 lg:grid-cols-2">
        <div>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="font-display my-4 text-[clamp(40px,5vw,64px)] whitespace-pre-line">{title}</h2>
          <p className="mb-6 text-[17px] leading-[1.5] text-bento-ink/80 text-pretty">
            {description}
          </p>
          <div className="flex flex-wrap gap-2.5">
            {platforms.map((p) => (
              <PlatformPill key={p.id} platform={p} />
            ))}
          </div>
        </div>
        <SpotifyEmbed showId={spotifyShowId} />
      </div>
    </section>
  );
}
