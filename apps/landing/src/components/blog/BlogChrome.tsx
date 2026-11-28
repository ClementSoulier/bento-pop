import Link from 'next/link';
import { clsx } from '@/lib/clsx';
import type { BlogCategory } from '@/content/blog';

export function Breadcrumbs({ items }: { items: Array<{ href?: string; label: string }> }) {
  return (
    <nav
      aria-label="Fil d'Ariane"
      className="font-mono text-[11px] uppercase tracking-[0.18em] text-bento-ink/65"
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i}>
            {item.href && !isLast ? (
              <Link href={item.href} className="hover:text-bento-ink">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'text-bento-ink' : ''} aria-current={isLast ? 'page' : undefined}>
                {item.label}
              </span>
            )}
            {!isLast ? <span className="mx-2">/</span> : null}
          </span>
        );
      })}
    </nav>
  );
}

/** Filtres de catégorie : « Tous » puis chaque catégorie qui a au moins un article. */
export function CategoryChips({
  categories,
  current,
}: {
  categories: Array<BlogCategory & { count: number }>;
  current: string | null;
}) {
  if (categories.length === 0) return null;
  const chip = (active: boolean) =>
    clsx(
      'rounded-full border-[3px] border-bento-ink px-4 pt-1.5 pb-1 font-bold uppercase tracking-[0.08em] text-[12px] transition-[transform,box-shadow]',
      active
        ? 'bg-bento-ink text-bento-yellow'
        : 'bg-bento-cream text-bento-ink shadow-[0_3px_0_var(--bento-ink)] hover:-translate-y-0.5',
    );
  return (
    <nav aria-label="Catégories du blog" className="mb-10 flex flex-wrap gap-2.5">
      <Link href="/blog" className={chip(current === null)} aria-current={current === null ? 'page' : undefined}>
        Tous
      </Link>
      {categories.map((c) => (
        <Link
          key={c.slug}
          href={`/blog/categorie/${c.slug}`}
          className={chip(current === c.slug)}
          aria-current={current === c.slug ? 'page' : undefined}
        >
          {c.name}
          <span className="ml-1.5 font-mono text-[10px] opacity-60">{c.count}</span>
        </Link>
      ))}
    </nav>
  );
}

export function EmptyBlog({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border-[4px] border-bento-ink bg-bento-cream px-8 py-16 text-center shadow-stamp">
      <p className="font-display-sm text-[24px]">Bientôt des articles</p>
      <p className="mt-3 text-[15px] text-bento-ink/70">{children}</p>
    </div>
  );
}
