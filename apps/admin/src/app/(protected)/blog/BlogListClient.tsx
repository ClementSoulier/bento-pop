'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { StatusBadge, type StatusKind } from '@/components/StatusBadge';
import { PencilIcon } from '@/components/icons';
import { POST_STATE_LABELS, postState, type PostState } from '@/lib/blog/status';
import { clsx } from '@/lib/clsx';

export type BlogListRow = {
  id: string;
  slug: string;
  title: string;
  status: 'draft' | 'published';
  published_at: string | null;
  updated_at: string;
  reading_minutes: number;
  authors: string[];
  category: string | null;
};

const FILTERS = [
  { value: 'all', label: 'Tous' },
  { value: 'published', label: 'Publiés' },
  { value: 'scheduled', label: 'Programmés' },
  { value: 'draft', label: 'Brouillons' },
] as const;

type Filter = (typeof FILTERS)[number]['value'];

const BADGE: Record<PostState, StatusKind> = {
  published: 'live',
  scheduled: 'soon',
  draft: 'draft',
};

const DATE = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  year: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
});

export function BlogListClient({
  posts,
  landingUrl,
}: {
  posts: BlogListRow[];
  landingUrl: string | null;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const rows = useMemo(
    () =>
      posts
        .map((p) => ({ ...p, state: postState(p.status, p.published_at) }))
        .filter((p) => filter === 'all' || p.state === filter),
    [posts, filter],
  );

  return (
    <>
      <div className="mb-5 flex items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className={clsx('admin-btn admin-btn-sm', filter === f.value && 'admin-btn-primary')}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="admin-card overflow-hidden">
        <table className="w-full text-left">
          <thead className="border-b border-admin-border bg-admin-surface-2">
            <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-admin-muted">
              <th className="px-4 py-2.5">Titre</th>
              <th className="px-4 py-2.5">Catégorie</th>
              <th className="px-4 py-2.5">Auteurs</th>
              <th className="px-4 py-2.5">Date</th>
              <th className="px-4 py-2.5">Statut</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-[13px] text-admin-muted">
                  {posts.length === 0 ? (
                    <>
                      Aucun article pour l’instant.{' '}
                      <Link href="/blog/nouveau" className="underline">
                        Écrire le premier
                      </Link>
                    </>
                  ) : (
                    'Aucun article dans ce filtre.'
                  )}
                </td>
              </tr>
            ) : (
              rows.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-admin-border last:border-b-0 hover:bg-admin-bg/40"
                >
                  <td className="px-4 py-3">
                    <Link href={`/blog/${p.id}`} className="text-[13px] font-semibold hover:underline">
                      {p.title}
                    </Link>
                    <div className="font-mono text-[11px] text-admin-muted">
                      /blog/{p.slug} · {p.reading_minutes} min
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[12px]">
                    {p.category ?? <span className="text-admin-muted">Sans catégorie</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {p.authors.length === 0 ? (
                        <span className="text-[11px] text-admin-muted">Aucun</span>
                      ) : (
                        p.authors.map((name, i) => (
                          <span
                            key={`${name}-${i}`}
                            className="rounded-full border border-admin-border bg-admin-surface-2 px-2 py-0.5 text-[11px] font-medium text-admin-ink-2"
                          >
                            {name}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-admin-muted">
                    {p.published_at ? DATE.format(new Date(p.published_at)) : 'Non datée'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={BADGE[p.state]} label={POST_STATE_LABELS[p.state]} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {p.state === 'published' && landingUrl ? (
                      <a
                        href={`${landingUrl.replace(/\/$/, '')}/blog/${p.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="admin-btn admin-btn-sm admin-btn-ghost"
                      >
                        Voir
                      </a>
                    ) : null}
                    <Link href={`/blog/${p.id}`} className="admin-btn admin-btn-sm admin-btn-ghost">
                      <PencilIcon />
                      Éditer
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
