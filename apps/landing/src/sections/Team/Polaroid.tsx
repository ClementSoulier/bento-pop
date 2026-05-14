import type { IconKey } from '@/components/icons';
import { iconRegistry } from '@/components/icons';
import type { TeamMember, TeamMemberSocials } from '@/lib/content/schemas';
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
      <SocialRow socials={member.socials} memberName={member.name} />
    </article>
  );
}

/** Plateformes affichables, dans l'ordre d'apparition voulu sur le polaroid. */
const SOCIAL_ORDER: Array<{
  key: keyof TeamMemberSocials;
  icon: IconKey;
  label: string;
}> = [
  { key: 'instagram', icon: 'instagram', label: 'Instagram' },
  { key: 'youtube',   icon: 'youtube',   label: 'YouTube'   },
  { key: 'twitch',    icon: 'twitch',    label: 'Twitch'    },
  { key: 'x',         icon: 'x',         label: 'X'         },
  { key: 'website',   icon: 'globe',     label: 'Site web'  },
];

function SocialRow({
  socials,
  memberName,
}: {
  socials: TeamMemberSocials;
  memberName: string;
}) {
  const links = SOCIAL_ORDER.flatMap((s) => {
    const href = socials[s.key];
    return href ? [{ ...s, href }] : [];
  });
  if (links.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {links.map((l) => {
        const Icon = iconRegistry[l.icon];
        return (
          <a
            key={l.key}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${l.label} · ${memberName}`}
            className="grid h-7 w-7 place-items-center rounded-full border-[2px] border-bento-ink bg-bento-cream text-bento-ink transition-transform duration-150 hover:-translate-y-0.5 hover:rotate-[-4deg] hover:bg-bento-yellow"
          >
            <Icon width={14} height={14} />
          </a>
        );
      })}
    </div>
  );
}

function PhotoSlot({ member }: { member: TeamMember }) {
  const { photo } = member;
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
        // alt vide : le nom du membre est déjà annoncé par le <h3> juste après —
        // un alt redondant ferait lire le nom deux fois aux lecteurs d'écran.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo.url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span
          className="font-display text-[64px] leading-none text-bento-cream/95"
          aria-hidden
          style={{ textShadow: '0 4px 0 rgba(0,0,0,0.25)' }}
        >
          {photo.initials}
        </span>
      )}
    </div>
  );
}
