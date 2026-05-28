'use client';

import { useState, useTransition } from 'react';
import {
  getSimilarsForItem,
  mergeItems,
  rejectItem,
  validateItem,
  type SimilarCandidate,
} from './actions';

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
  const [showMerge, setShowMerge] = useState(false);
  const [candidates, setCandidates] = useState<SimilarCandidate[] | null>(null);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

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

  const onToggleMerge = async () => {
    const next = !showMerge;
    setShowMerge(next);
    if (next && candidates === null) {
      setLoadingCandidates(true);
      const res = await getSimilarsForItem({ itemId: item.id });
      setLoadingCandidates(false);
      if (!res.ok) {
        setError(res.error);
        setCandidates([]);
        return;
      }
      setCandidates(res.candidates);
    }
  };

  const onMergeInto = (canonical: SimilarCandidate) => {
    if (
      !confirm(
        `Fusionner « ${item.title} » dans « ${canonical.title}${
          canonical.year ? ` (${canonical.year})` : ''
        } » ?\n\nLes bento_items qui pointent vers la proposition seront réécrits vers le canonique, et le titre soumis deviendra un alias.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await mergeItems({
        canonicalId: canonical.id,
        loserIds: [item.id],
      });
      if (!res.ok) setError(res.error);
      else setError(null);
    });
  };

  return (
    <div className="flex flex-col px-4 py-3.5">
      <div className="flex items-start gap-4">
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
            onClick={onToggleMerge}
            disabled={pending}
            className="rounded-md border border-admin-border bg-admin-bg px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] hover:bg-admin-ink hover:text-bento-cream disabled:opacity-50"
          >
            {showMerge ? 'Annuler' : 'Fusionner'}
          </button>
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

      {showMerge ? (
        <div className="mt-3 rounded-md border border-admin-border bg-admin-bg/40 px-3 py-2.5">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-admin-muted">
            Fusionner avec un item validé
          </div>
          {loadingCandidates ? (
            <div className="py-3 text-center text-[12px] text-admin-muted">
              Recherche des similaires…
            </div>
          ) : candidates && candidates.length > 0 ? (
            <ul className="flex flex-col divide-y divide-admin-border">
              {candidates.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-[13px] font-semibold">
                      {c.title}
                      {c.year ? (
                        <span className="ml-1 font-normal text-admin-muted">
                          ({c.year})
                        </span>
                      ) : null}
                    </div>
                    {c.subtitle ? (
                      <div className="truncate text-[11px] text-admin-muted">
                        {c.subtitle}
                      </div>
                    ) : null}
                    <div className="font-mono text-[10px] text-admin-muted">
                      score {Math.round(c.score * 100)}%
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onMergeInto(c)}
                    disabled={pending}
                    className="rounded-md border-2 border-bento-ink bg-bento-cream px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] hover:-translate-y-0.5 disabled:opacity-50"
                  >
                    Fusionner ici
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-2 text-[12px] text-admin-muted">
              Aucun item validé similaire trouvé. Valide pour créer un nouveau
              canonique, ou refuse si la proposition n&apos;est pas pertinente.
            </div>
          )}
        </div>
      ) : null}
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
