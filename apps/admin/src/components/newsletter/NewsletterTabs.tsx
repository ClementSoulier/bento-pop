import Link from 'next/link';
import { clsx } from '@/lib/clsx';

const TABS = [
  { id: 'inscrits', href: '/newsletter', label: 'Inscrits' },
  { id: 'numeros', href: '/newsletter/numeros', label: 'Numéros' },
] as const;

/** Les deux onglets de la newsletter : la liste des inscrits et les numéros envoyés. */
export function NewsletterTabs({ active }: { active: (typeof TABS)[number]['id'] }) {
  return (
    <nav aria-label="Newsletter" className="mb-5 flex gap-2">
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          aria-current={tab.id === active ? 'page' : undefined}
          className={clsx(
            'rounded-full border-2 border-bento-ink px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em]',
            tab.id === active ? 'bg-bento-ink text-bento-cream' : 'bg-admin-bg hover:bg-bento-cream',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
