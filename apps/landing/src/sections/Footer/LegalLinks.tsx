import type { LegalLink } from '@/lib/content/schemas';

type LegalLinksProps = { links: LegalLink[] };

export function LegalLinks({ links }: LegalLinksProps) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {links.map((l) => (
        <a
          key={l.id}
          href={l.href}
          className="underline underline-offset-[3px] hover:text-bento-yellow"
        >
          {l.label}
        </a>
      ))}
    </div>
  );
}
