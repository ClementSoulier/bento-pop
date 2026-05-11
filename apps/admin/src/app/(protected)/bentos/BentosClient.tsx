'use client';

import { useState, useTransition } from 'react';
import { setBentoFeatured } from './actions';

export type BentoRow = {
  id: string;
  userId: string;
  pseudo: string;
  displayName: string | null;
  isFeatured: boolean;
  featuredOrder: number | null;
  publishedAt: string;
};

type BentosClientProps = { rows: BentoRow[] };

export function BentosClient({ rows: initialRows }: BentosClientProps) {
  const [rows, setRows] = useState(initialRows);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggleFeatured = (row: BentoRow) => {
    const nextFeatured = !row.isFeatured;
    const nextOrder = nextFeatured
      ? (rows.filter((r) => r.isFeatured && r.id !== row.id).length + 1)
      : null;

    // Optimistic update
    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id ? { ...r, isFeatured: nextFeatured, featuredOrder: nextOrder } : r,
      ),
    );

    startTransition(async () => {
      const res = await setBentoFeatured({
        bentoId: row.id,
        isFeatured: nextFeatured,
        featuredOrder: nextOrder,
      });
      if (!res.ok) {
        setError(res.error);
        // Rollback
        setRows(initialRows);
      } else {
        setError(null);
      }
    });
  };

  const updateOrder = (row: BentoRow, order: number) => {
    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, featuredOrder: order } : r)),
    );
    startTransition(async () => {
      const res = await setBentoFeatured({
        bentoId: row.id,
        isFeatured: row.isFeatured,
        featuredOrder: order,
      });
      if (!res.ok) {
        setError(res.error);
        setRows(initialRows);
      } else {
        setError(null);
      }
    });
  };

  if (rows.length === 0) {
    return (
      <div className="admin-card p-6 text-[14px] text-admin-muted">
        Aucun bento publié pour le moment.
      </div>
    );
  }

  return (
    <div className="admin-card overflow-hidden">
      {error ? (
        <div className="border-b border-bento-red bg-bento-red/10 px-4 py-2 text-[12px] text-bento-red">
          {error}
        </div>
      ) : null}
      <table className="w-full text-[13px]">
        <thead className="border-b border-admin-border bg-admin-bg/60">
          <tr className="text-left font-mono text-[10px] uppercase tracking-[0.18em] text-admin-muted">
            <th className="px-4 py-2.5">Pseudo</th>
            <th className="px-4 py-2.5">Nom</th>
            <th className="px-4 py-2.5">Publié le</th>
            <th className="px-4 py-2.5 text-center">Featured</th>
            <th className="px-4 py-2.5 text-center">Ordre</th>
            <th className="px-4 py-2.5 text-right">Public</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-admin-border last:border-b-0 hover:bg-admin-bg/40">
              <td className="px-4 py-3 font-semibold">@{r.pseudo}</td>
              <td className="px-4 py-3 text-admin-muted">{r.displayName ?? '—'}</td>
              <td className="px-4 py-3 font-mono text-[11px] text-admin-muted">
                {new Date(r.publishedAt).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </td>
              <td className="px-4 py-3 text-center">
                <button
                  type="button"
                  onClick={() => toggleFeatured(r)}
                  disabled={pending}
                  className={`rounded-full border-2 border-bento-ink px-3 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
                    r.isFeatured
                      ? 'bg-bento-red text-bento-cream'
                      : 'bg-admin-bg text-admin-muted hover:bg-admin-ink hover:text-bento-yellow'
                  }`}
                >
                  {r.isFeatured ? '★ Featured' : 'Off'}
                </button>
              </td>
              <td className="px-4 py-3 text-center">
                {r.isFeatured ? (
                  <input
                    type="number"
                    min={1}
                    value={r.featuredOrder ?? ''}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (Number.isFinite(v)) updateOrder(r, v);
                    }}
                    disabled={pending}
                    className="w-16 rounded border border-admin-border bg-admin-bg px-2 py-1 text-center text-[12px]"
                  />
                ) : (
                  <span className="font-mono text-[11px] text-admin-muted">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <a
                  href={`https://bento-pop.com/u/${r.pseudo}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[11px] uppercase tracking-[0.12em] text-admin-muted hover:text-admin-ink"
                >
                  Voir →
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
