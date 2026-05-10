import type { Platform } from '@/lib/content/schemas';
import { iconRegistry } from '@/components/icons';

type PlatformPillProps = { platform: Platform };

const ICON_TINT: Record<Platform['iconKey'], string> = {
  spotify: '#1DB954',
  youtube: '#FF0000',
  deezer: '#9933CC',
  apple: '#9933FF',
};

export function PlatformPill({ platform }: PlatformPillProps) {
  const Icon = iconRegistry[platform.iconKey];
  return (
    <a
      href={platform.href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-full border-[3px] border-bento-ink bg-white px-4 pt-2.5 pb-2 text-[13px] font-bold tracking-[0.05em] shadow-stamp transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-stamp-lg"
    >
      <Icon width={18} height={18} style={{ color: ICON_TINT[platform.iconKey] }} />
      {platform.label}
    </a>
  );
}
