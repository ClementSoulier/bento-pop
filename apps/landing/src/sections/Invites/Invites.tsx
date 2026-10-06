import popyGene from '@bento-pop/brand/assets/mascot/popy-gene.png';
import { SectionHead } from '@/components/SectionHead';
import { FloatingPopy } from '@/sections/Hero/FloatingPopy';
import { formatPublishedDate } from '@/lib/episodes';
import { getGuestShorts, GUEST_SHORTS_PLAYLIST_URL } from '@/lib/shorts/source';
import { InvitesSlider } from './InvitesSlider';

/**
 * Slider des shorts « Mon Bento Pop » : chaque invité compose son bento.
 * Alimenté par la playlist YouTube, sans saisie dans le BO. Si le flux est
 * injoignable et qu'aucune copie n'est en cache, la section disparaît.
 */
export async function Invites() {
  const shorts = await getGuestShorts();
  if (shorts.length === 0) return null;

  return (
    <section
      id="invites"
      aria-labelledby="invites-titre"
      className="relative overflow-hidden border-t-[5px] border-bento-ink bg-bento-ink py-[90px]"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: 'radial-gradient(var(--bento-yellow) 1.5px, transparent 1.5px)',
          backgroundSize: '28px 28px',
        }}
      />
      {/* Masqué sur téléphone : il recouvrirait le surtitre. */}
      <div className="hidden md:block">
        <FloatingPopy
          config={{
            id: 'invites',
            mascotPath: popyGene.src,
            size: 84,
            rotation: 10,
            delaySeconds: -1,
            position: { top: '64px', right: '6%' },
          }}
        />
      </div>
      <div className="relative mx-auto max-w-[1320px] px-7">
        <SectionHead
          eyebrow="Shorts · Nos invités"
          tone="dark"
          className="mb-12"
          title={
            <span id="invites-titre">
              Le Bento Pop de nos{' '}
              <span className="inline-block -rotate-2 text-bento-yellow">invités !</span>
            </span>
          }
          description="Chaque invité compose son bento pop culture en direct. Lance un short, découvre ce qu'il a mis dans sa boîte."
        />
      </div>
      <InvitesSlider
        shorts={shorts.map((s) => ({ ...s, dateLabel: formatPublishedDate(s.publishedAt) }))}
        playlistUrl={GUEST_SHORTS_PLAYLIST_URL}
      />
    </section>
  );
}
