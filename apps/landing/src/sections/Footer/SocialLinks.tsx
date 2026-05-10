import type { SocialLink } from '@/lib/content/schemas';
import { iconRegistry } from '@/components/icons';

type SocialLinksProps = { socials: SocialLink[] };

const PLATFORM_LABEL: Record<SocialLink['platform'], string> = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  x: 'X',
  tiktok: 'TikTok',
};

export function SocialLinks({ socials }: SocialLinksProps) {
  return (
    <div className="mb-7 flex flex-wrap gap-3">
      {socials.map((s) => {
        const Icon = iconRegistry[s.platform];
        return (
          <a
            key={s.id}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={PLATFORM_LABEL[s.platform]}
            className="grid h-[54px] w-[54px] place-items-center rounded-2xl border-[3px] border-bento-cream bg-bento-cream text-bento-ink transition-[transform,background] duration-150 hover:-translate-y-1 hover:rotate-[-3deg] hover:bg-bento-yellow"
          >
            <Icon width={24} height={24} />
          </a>
        );
      })}
    </div>
  );
}
