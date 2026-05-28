'use client';

import { useState, useTransition } from 'react';
import { rejectItem, validateItem } from './actions';

export type CatalogueItemRow = {
  id: string;
  title: string;
  categoryLabel: string;
  categoryKey: string | null;
  submittedAt: string | null;
  authorPseudo: string | null;
  status: 'pending' | 'validated' | 'rejected';
  rejectedReason?: string | null;
};

type Props = { pending: CatalogueItemRow[]; handled: CatalogueItemRow[] };

export function CatalogueClient({ pending, handled }: Props) {
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <div className="admin-card border-bento-red bg-bento-red/10 px-4 py-3 text-[13px] text-bento-red">
          {error}
        </div>
      ) : null}

      <Section
        title={`À modérer (${pending.length})`}
        empty="Aucune proposition en attente. ✨"
      >
        {pending.map((item) => (
          <PendingRow key={item.id} item={item} setError={setError} />
        ))}
      </Section>

      <Section
        title={`Récemment traités (${handled.length})`}
        empty="Aucun item modéré récemment."
      >
        {handled.slice(0, 20).map((item) => (
          <HandledRow key={item.id} item={item} />
        ))}
      </Section>
    </div>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children) && children.length > 0;
  return (
    <section className="admin-card overflow-hidden">
      <header className="border-b border-admin-border bg-admin-bg/60 px-4 py-3 text-[13px] font-semibold">
        {title}
      </header>
      {hasChildren ? (
        <div className="flex flex-col divide-y divide-admin-border">{children}</div>
      ) : (
        <div className="px-4 py-6 text-center text-[12px] text-admin-muted">{empty}</div>
      )}
    </section>
  );
}

function PendingRow({
  item,
  setError,
}: {
  item: CatalogueItemRow;
  setError: (e: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();

  const onValidate = () => {
    startTransition(async () => {
      const res = await validateItem({ itemId: item.id });
      if (!res.ok) setError(res.error);
      else setError(null);
    });
  };

  const onReject = () => {
    const reason = window.prompt(
      `Refuser « ${item.title} » ?\n\nMotif (optionnel, pour traçabilité interne) :`,
      '',
    );
    if (reason === null) return;
    startTransition(async () => {
      const res = await rejectItem({
        itemId: item.id,
        reason: reason.trim() || undefined,
      });
      if (!res.ok) setError(res.error);
      else setError(null);
    });
  };

  return (
    <div className="flex items-start gap-4 px-4 py-3.5">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-admin-muted">
            {item.categoryLabel}
          </span>
          <span className="text-[14px] font-semibold">{item.title}</span>
        </div>
        <div className="mt-1 font-mono text-[10px] text-admin-muted">
          {item.submittedAt
            ? new Date(item.submittedAt).toLocaleString('fr-FR', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '—'}
          {item.authorPseudo ? (
            <>
              {' · '}
              par <span className="text-admin-ink">@{item.authorPseudo}</span>
            </>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={onReject}
          disabled={pending}
          className="rounded-md border border-admin-border bg-admin-bg px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] hover:bg-admin-ink hover:text-bento-cream disabled:opacity-50"
        >
          Refuser
        </button>
        <button
          type="button"
          onClick={onValidate}
          disabled={pending}
          className="rounded-md border-2 border-bento-ink bg-bento-yellow px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-bento-ink hover:-translate-y-0.5 disabled:opacity-50"
        >
          Valider
        </button>
      </div>
    </div>
  );
}

function HandledRow({ item }: { item: CatalogueItemRow }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 text-[12px]">
      <span
        className={`rounded-full border-2 border-bento-ink px-2 py-px font-mono text-[9px] uppercase tracking-[0.15em] ${
          item.status === 'validated'
            ? 'bg-bento-yellow text-bento-ink'
            : 'bg-admin-bg text-admin-muted'
        }`}
      >
        {item.status === 'validated' ? 'validé' : 'rejeté'}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-admin-muted">
        {item.categoryLabel}
      </span>
      <span className="font-semibold">{item.title}</span>
      {item.rejectedReason ? (
        <span className="text-admin-muted">· {item.rejectedReason}</span>
      ) : null}
      <span className="ml-auto font-mono text-[10px] text-admin-muted">
        {item.submittedAt
          ? new Date(item.submittedAt).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'short',
            })
          : '—'}
      </span>
    </div>
  );
}
