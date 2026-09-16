'use client';

import { useState, useTransition } from 'react';
import { publicBentoUrl } from '@/lib/bento-url';
import { banUser, dismissReport } from './actions';

export type ReportRow = {
  id: string;
  targetKind: 'bento' | 'pseudo';
  targetPseudo: string;
  targetUserId: string | null;
  targetBentoId: string | null;
  /** Adresse du bento signalé, résolue depuis `targetBentoId`. Chantier 16. */
  targetBentoSlug: string | null;
  targetBentoIsPrimary: boolean | null;
  reason: string | null;
  status: 'pending' | 'reviewed' | 'dismissed';
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
};

type Props = { pending: ReportRow[]; handled: ReportRow[] };

export function ReportsClient({ pending, handled }: Props) {
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <div className="admin-card border-bento-red bg-bento-red/10 px-4 py-3 text-[13px] text-bento-red">
          {error}
        </div>
      ) : null}

      <Section
        title={`En attente (${pending.length})`}
        empty="Aucun signalement en attente. 🎉"
      >
        {pending.map((r) => (
          <PendingRow key={r.id} report={r} setError={setError} />
        ))}
      </Section>

      <Section
        title={`Traités (${handled.length})`}
        empty="Aucun signalement traité pour le moment."
      >
        {handled.slice(0, 20).map((r) => (
          <HandledRow key={r.id} report={r} />
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
  report,
  setError,
}: {
  report: ReportRow;
  setError: (e: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();

  const onDismiss = () => {
    startTransition(async () => {
      const res = await dismissReport({ reportId: report.id });
      if (!res.ok) setError(res.error);
      else setError(null);
    });
  };

  const onBan = () => {
    if (!report.targetUserId) {
      setError(`Pseudo « ${report.targetPseudo} » introuvable (déjà supprimé ?). Marque comme rejeté à la place.`);
      return;
    }
    // « son bento » au singulier sous-déclarait ce que la cascade détruit :
    // le bannissement supprime le compte, donc TOUS ses bentos, et non le
    // seul qui a été signalé. Une confirmation d'action irréversible doit
    // dire ce qu'elle fait. Chantier 16.
    if (
      !confirm(
        `Bannir définitivement @${report.targetPseudo} ? Cette action supprime son compte et TOUS ses bentos, pas seulement celui qui est signalé.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await banUser({ reportId: report.id, targetUserId: report.targetUserId! });
      if (!res.ok) setError(res.error);
      else setError(null);
    });
  };

  return (
    <div className="flex items-start gap-4 px-4 py-3.5">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-admin-muted">
            {report.targetKind}
          </span>
          <span className="text-[14px] font-semibold">@{report.targetPseudo}</span>
        </div>
        {report.reason ? (
          <p className="mt-1 text-[12px] text-admin-muted">{report.reason}</p>
        ) : (
          <p className="mt-1 text-[12px] italic text-admin-muted">(pas de motif fourni)</p>
        )}
        <div className="mt-1 font-mono text-[10px] text-admin-muted">
          {new Date(report.createdAt).toLocaleString('fr-FR', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
          {' · '}
          {/* Le bento signalé, et non le principal du compte : les deux
              coïncidaient tant qu'un compte n'en avait qu'un. Un signalement
              sans identifiant de bento, d'avant le chantier 16, mène toujours
              au compte, et le dit. */}
          <a
            href={publicBentoUrl(
              report.targetPseudo,
              report.targetBentoSlug,
              report.targetBentoIsPrimary ?? true,
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {report.targetBentoSlug && report.targetBentoIsPrimary === false
              ? `Voir ${report.targetBentoSlug} ↗`
              : report.targetBentoId
                ? 'Voir le bento ↗'
                : 'Voir le compte ↗'}
          </a>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={onDismiss}
          disabled={pending}
          className="rounded-md border border-admin-border bg-admin-bg px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] hover:bg-admin-ink hover:text-bento-cream disabled:opacity-50"
        >
          Rejeter
        </button>
        <button
          type="button"
          onClick={onBan}
          disabled={pending}
          className="rounded-md border-2 border-bento-ink bg-bento-red px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-bento-cream hover:-translate-y-0.5 disabled:opacity-50"
        >
          Bannir
        </button>
      </div>
    </div>
  );
}

function HandledRow({ report }: { report: ReportRow }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 text-[12px]">
      <span
        className={`rounded-full border-2 border-bento-ink px-2 py-px font-mono text-[9px] uppercase tracking-[0.15em] ${
          report.status === 'reviewed'
            ? 'bg-bento-red text-bento-cream'
            : 'bg-admin-bg text-admin-muted'
        }`}
      >
        {report.status === 'reviewed' ? 'banni' : 'rejeté'}
      </span>
      <span className="font-semibold">@{report.targetPseudo}</span>
      <span className="text-admin-muted">·</span>
      <span className="font-mono text-[10px] text-admin-muted">
        {report.reviewedAt
          ? new Date(report.reviewedAt).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'short',
            })
          : '?'}
        {report.reviewedBy ? ` par ${report.reviewedBy}` : ''}
      </span>
    </div>
  );
}
