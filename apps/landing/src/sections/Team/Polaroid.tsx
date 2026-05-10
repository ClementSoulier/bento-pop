import type { TeamMember } from '@/lib/content/schemas';
import { clsx } from '@/lib/clsx';

type PolaroidProps = { member: TeamMember };

export function Polaroid({ member }: PolaroidProps) {
  return (
    <article
      className={clsx(
        'group bg-white border-[3px] border-bento-ink px-3.5 pb-4 pt-3.5',
        'shadow-[0_8px_0_var(--bento-ink),0_16px_30px_rgba(0,0,0,0.15)]',
        'transition-transform duration-200',
        'hover:!rotate-0 hover:-translate-y-1.5 hover:z-10',
      )}
      style={{ transform: `rotate(${member.rotation}deg)` }}
    >
      <PhotoSlot member={member} />
      <h3 className="font-display mt-3.5 mb-1 text-[17px] md:text-[22px]">{member.name}</h3>
      <div className="font-nick mb-1.5 text-[13px] text-bento-red">{member.nick}</div>
      <p className="text-[12px] leading-[1.4] text-bento-ink/70">{member.bio}</p>
    </article>
  );
}

function PhotoSlot({ member }: { member: TeamMember }) {
  const { photo, nick } = member;
  const initials = photo.kind === 'gradient' ? photo.initials : photo.initials;
  return (
    <div
      className="relative grid aspect-square place-items-center overflow-hidden border-[3px] border-bento-ink"
      style={
        photo.kind === 'gradient'
          ? { background: `linear-gradient(135deg, ${photo.from} 0%, ${photo.to} 100%)` }
          : undefined
      }
    >
      {photo.kind === 'image' ? (
        <img src={photo.url} alt={member.name} className="h-full w-full object-cover" />
      ) : (
        <span
          className="font-display text-[64px] leading-none text-bento-cream/95"
          aria-hidden
          style={{ textShadow: '0 4px 0 rgba(0,0,0,0.25)' }}
        >
          {initials}
        </span>
      )}
    </div>
  );
}
