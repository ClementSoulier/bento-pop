'use client';

import { useMemo, useState, useTransition } from 'react';
import { SearchIcon, TrashIcon } from '@/components/icons';
import { formatNumber } from '@/lib/format';
import {
  filterSubscribers,
  sourceLabel,
  subscribersCsv,
  type SubscriberRow,
} from '@/lib/newsletter';
import { deleteSubscriber } from './actions';

const DATE = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
});

/** Le fichier porte la date du jour à Paris : `newsletter-bento-pop-2026-11-26.csv`. */
function csvFilename(now = new Date()): string {
  const day = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(now);
  return `newsletter-bento-pop-${day}.csv`;
}

function downloadCsv(rows: readonly SubscriberRow[]) {
  const blob = new Blob([subscribersCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = csvFilename();
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function NewsletterClient({
  rows,
  lastMonth,
}: {
  rows: SubscriberRow[];
  /** Inscriptions des 30 derniers jours, comptées par le serveur. */
  lastMonth: number;
}) {
  const [query, setQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const visible = useMemo(() => filterSubscribers(rows, query), [rows, query]);

  function remove(row: SubscriberRow) {
    if (
      !confirm(
        `Retirer ${row.email} de la newsletter ? L’adresse est effacée définitivement de la liste.`,
      )
    ) {
      return;
    }
    setError(null);
    setDeletingId(row.id);
    startTransition(async () => {
      const result = await deleteSubscriber(row.id);
      if (!result.ok) setError(result.error);
      setDeletingId(null);
    });
  }

  return (
    <>
      <div className="mb-5 grid grid-cols-3 gap-4">
        <Stat label="Inscrits" value={rows.length} hint="adresses dans la liste" />
        <Stat label="30 derniers jours" value={lastMonth} hint="nouvelles inscriptions" />
        <div className="admin-card flex flex-col justify-center gap-2 p-4">
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            disabled={rows.length === 0}
            onClick={() => downloadCsv(rows)}
          >
            Exporter en CSV
          </button>
          <span className="text-[11px] text-admin-muted">
            Toute la liste, pour l’importer dans l’outil d’envoi.
          </span>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <label className="relative w-full max-w-[360px]">
          <span className="sr-only">Rechercher une adresse</span>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une adresse"
            className="admin-input !pl-9"
          />
        </label>
        {query.trim() ? (
          <span className="text-[12px] text-admin-muted">
            {formatNumber(visible.length)} résultat{visible.length > 1 ? 's' : ''}
          </span>
        ) : null}
      </div>

      {error ? (
        <div role="alert" className="admin-card mb-4 border-l-4 border-l-bento-red p-3 text-[13px]">
          {error}
        </div>
      ) : null}

      <div className="admin-card overflow-hidden">
        <table className="w-full text-left">
          <thead className="border-b border-admin-border bg-admin-surface-2">
            <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-admin-muted">
              <th className="px-4 py-2.5">Adresse</th>
              <th className="px-4 py-2.5">Inscrit le</th>
              <th className="px-4 py-2.5">Provenance</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-[13px] text-admin-muted">
                  {rows.length === 0
                    ? 'Personne n’est encore inscrit. Le formulaire est sur l’accueil et en pied de page de la landing.'
                    : 'Aucune adresse ne correspond à cette recherche.'}
                </td>
              </tr>
            ) : (
              visible.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-admin-border last:border-b-0 hover:bg-admin-bg/40"
                >
                  <td className="px-4 py-3 text-[13px] font-semibold">{r.email}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-admin-muted">
                    {DATE.format(new Date(r.consent_at))}
                  </td>
                  <td className="px-4 py-3 text-[12px]">{sourceLabel(r.source)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button
                      type="button"
                      className="admin-btn admin-btn-sm admin-btn-ghost"
                      disabled={deletingId !== null}
                      onClick={() => remove(r)}
                      aria-label={`Retirer ${r.email} de la newsletter`}
                    >
                      <TrashIcon />
                      {deletingId === r.id ? 'Suppression…' : 'Retirer'}
                    </button>
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

function Stat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="admin-card flex flex-col gap-1 p-4">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-admin-muted">
        {label}
      </span>
      <span className="font-display text-[36px] leading-none">{formatNumber(value)}</span>
      <span className="text-[11px] text-admin-muted">{hint}</span>
    </div>
  );
}
