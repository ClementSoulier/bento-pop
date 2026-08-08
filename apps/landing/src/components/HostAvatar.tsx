import { clsx } from '@/lib/clsx';
import { SmartImage } from '@/components/SmartImage';
import type { EpisodeHostPhoto } from '@/content/episodes';

type Size = 'xs' | 'sm' | 'md';

const SIZE_CLASSES: Record<Size, string> = {
  xs: 'h-7 w-7 border-[2px] text-[10px]',
  sm: 'h-9 w-9 border-[2px] text-[11px]',
  md: 'h-10 w-10 border-[3px] text-[12px]',
};

/** Côté rendu en px, aligné sur `SIZE_CLASSES` (h-7 = 28px, etc.). */
const SIZE_PX: Record<Size, number> = {
  xs: 28,
  sm: 36,
  md: 40,
};

type HostAvatarProps = {
  photo: EpisodeHostPhoto;
  name: string;
  size?: Size;
  className?: string;
};

/**
 * Avatar circulaire d'un animateur — soit la photo (si `kind: 'image'` et
 * `url` présente), soit un fond gradient avec les initiales en surimpression.
 * Cohérent avec le pattern de `Polaroid` côté Team.
 */
export function HostAvatar({ photo, name, size = 'md', className }: HostAvatarProps) {
  const base = clsx(
    'grid place-items-center overflow-hidden rounded-full border-bento-ink shrink-0',
    SIZE_CLASSES[size],
    className,
  );

  if (photo.kind === 'image') {
    return (
      <span className={base} title={name}>
        <SmartImage
          src={photo.url}
          alt=""
          width={SIZE_PX[size]}
          height={SIZE_PX[size]}
          className="h-full w-full object-cover"
        />
      </span>
    );
  }

  return (
    <span
      className={clsx(base, 'font-mono font-bold text-bento-cream')}
      title={name}
      style={{ background: `linear-gradient(135deg, ${photo.from} 0%, ${photo.to} 100%)` }}
    >
      {photo.initials}
    </span>
  );
}
