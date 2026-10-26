'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { publicBentoUrl } from '@/lib/bento-url';
import { reasonLabel } from '@/lib/moderation/digest';
import { banUser, dismissReport, hideComment, hideWhy, restoreComment, restoreWhy } from './actions';

export type ReportRow = {
  id: string;
  targetKind: 'bento' | 'pseudo' | 'comment' | 'account' | 'why';
  targetPseudo: string;
  targetUserId: string | null;
  targetBentoId: string | null;
  /** Adresse du bento signalé, résolue depuis `targetBentoId`. Chantier 16. */
  targetBentoSlug: string | null;
  targetBentoIsPrimary: boolean | null;
  /** Chantier 22 : le commentaire visé, et son état s'il existe encore. */
  targetCommentId: string | null;
  targetCommentStatus: 'visible' | 'hidden' | null;
  /** Chantier 12 : le pourquoi visé, et son état s'il existe encore. */
  targetWhyId: string | null;
  targetWhyStatus: 'visible' | 'hidden' | null;
  /** Le commentaire ou le pourquoi tel qu'il était au signalement. */
  targetText: string | null;
  /** Texte libre des versions publiées. */
  reason: string | null;
  reasonCode: string | null;
  details: string | null;
  /** `null` pour un signaleur sans profil, ou effacé depuis. */
  reporterPseudo: string | null;
  status: 'pending' | 'reviewed' | 'dismissed';
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
};

export type CommentRow = {
  id: string;
  body: string;
  status: 'visible' | 'hidden';
  hiddenReason: string | null;
  createdAt: string;
  authorPseudo: string;
  bento: { slug: string; isPrimary: boolean; ownerPseudo: string | null } | null;
};

/** Un pourquoi de l'onglet du même nom, chantier 12 (D9). */
export type WhyRow = {
  id: string;
  body: string;
  status: 'visible' | 'hidden';
  hiddenReason: string | null;
  updatedAt: string;
  /** L'intitulé de la case : « Film », ou la question d'une édition. */
  casePrompt: string;
  itemTitle: string | null;
  bento: { slug: string; isPrimary: boolean; ownerPseudo: string | null } | null;
};

type Props = {
  tab: 'reports' | 'comments' | 'whys';
  pending: ReportRow[];
  handled: ReportRow[];
  comments: CommentRow[];
  whys: WhyRow[];
  /** Faux tant que le mail à l'équipe n'est pas en service (D11). */
  mailReady: boolean;
};

const KINDS: Record<ReportRow['targetKind'], string> = {
  comment: 'Commentaire',
  why: 'Pourquoi',
  account: 'Compte',
  bento: 'Bento',
  pseudo: 'Pseudo',
};

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * La modération, chantier 22 (§5.7) : Signalements et Commentaires.
 * Remplace la liste des signalements du MVP, qui ne connaissait que des
 * bentos et des pseudos, sans motif.
 */
export function ModerationClient({ tab, pending, handled, comments, whys, mailReady }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex gap-2" aria-label="Onglets de la modération">
        <TabLink href="/reports" active={tab === 'reports'}>
          Signalements ({pending.length})
        </TabLink>
        <TabLink href="/reports?onglet=commentaires" active={tab === 'comments'}>
          Commentaires
        </TabLink>
        <TabLink href="/reports?onglet=pourquoi" active={tab === 'whys'}>
          Pourquoi
        </TabLink>
      </nav>

      {!mailReady ? (
        <div className="admin-card border-bento-orange bg-bento-orange/10 px-4 py-3 text-[13px]">
          Le mail à l&apos;équipe n&apos;est pas en service : il attend <code>RESEND_API_KEY</code>,{' '}
          <code>MODERATION_FROM</code>, <code>MODERATION_ALERT_TO</code> et{' '}
          <code>ADMIN_PUBLIC_URL</code>, variables runtime sur Coolify. Les signalements
          s&apos;affichent quand même ici.
        </div>
      ) : null}

      {error ? (
        <div className="admin-card border-bento-red bg-bento-red/10 px-4 py-3 text-[13px] text-bento-red">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="admin-card px-4 py-3 text-[13px]" role="status">
          {notice}
        </div>
      ) : null}

      {tab === 'reports' ? (
        <>
          <Section
            title={`En attente (${pending.length})`}
            empty="Aucun signalement en attente. 🎉"
          >
            {pending.map((r) => (
              <PendingRow key={r.id} report={r} setError={setError} setNotice={setNotice} />
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
        </>
      ) : tab === 'comments' ? (
        <Section
          title={`Les ${comments.length} derniers commentaires`}
          empty="Aucun commentaire pour l'instant."
        >
          {comments.map((c) => (
            <CommentLine key={c.id} comment={c} setError={setError} />
          ))}
        </Section>
      ) : (
        <Section
          title={`Les ${whys.length} derniers pourquoi`}
          empty="Aucun pourquoi pour l'instant."
        >
          {whys.map((w) => (
            <WhyLine key={w.id} why={w} setError={setError} />
          ))}
        </Section>
      )}
    </div>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`rounded-full border-2 border-bento-ink px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] ${
        active ? 'bg-bento-ink text-bento-cream' : 'bg-admin-bg hover:bg-bento-cream'
      }`}
    >
      {children}
    </Link>
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

const buttonQuiet =
  'rounded-md border border-admin-border bg-admin-bg px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] hover:bg-admin-ink hover:text-bento-cream disabled:opacity-50';
const buttonStrong =
  'rounded-md border-2 border-bento-ink px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] hover:-translate-y-0.5 disabled:opacity-50';

function PendingRow({
  report,
  setError,
  setNotice,
}: {
  report: ReportRow;
  setError: (e: string | null) => void;
  setNotice: (n: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  const label = report.reasonCode ? reasonLabel(report.reasonCode) : null;
  const canHide =
    (report.targetKind === 'comment' && report.targetCommentStatus === 'visible') ||
    (report.targetKind === 'why' && report.targetWhyStatus === 'visible');

  const run = (action: () => Promise<{ ok: true } | { ok: false; error: string }>) =>
    startTransition(async () => {
      const res = await action();
      setError(res.ok ? null : res.error);
    });

  const onHide = () => {
    // Un geste : le motif du signalement, que l'auteur verra sous son
    // commentaire ou son pourquoi.
    const reason = label ?? 'Contraire aux règles';
    if (report.targetKind === 'why' && report.targetWhyId) {
      run(() => hideWhy({ whyId: report.targetWhyId!, reason }));
    } else if (report.targetCommentId) {
      run(() => hideComment({ commentId: report.targetCommentId!, reason }));
    }
  };

  const onBan = () => {
    if (!report.targetUserId) {
      setError(
        `Compte « ${report.targetPseudo} » introuvable (déjà supprimé ?). Classe le signalement à la place.`,
      );
      return;
    }
    // Le bannissement supprime le compte, donc TOUS ses bentos et ses
    // commentaires, et non le seul qui a été signalé (chantier 16).
    const reason = window.prompt(
      `Bannir définitivement @${report.targetPseudo} ? Son compte, TOUS ses bentos et ses commentaires seront supprimés. Motif, envoyé à son adresse s'il en a gardé une :`,
      label ?? '',
    );
    if (!reason?.trim()) return;
    startTransition(async () => {
      const res = await banUser({ targetUserId: report.targetUserId!, reason: reason.trim() });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setError(null);
      setNotice(
        res.noticeSent
          ? `@${report.targetPseudo} est banni, et le motif est parti à son adresse.`
          : `@${report.targetPseudo} est banni. Aucun motif envoyé : pas d'adresse gardée, ou mail hors service.`,
      );
    });
  };

  return (
    <div className="flex items-start gap-4 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-admin-muted">
            {KINDS[report.targetKind]}
          </span>
          <span className="text-[14px] font-semibold">@{report.targetPseudo}</span>
          {label ? (
            <span className="rounded-full border border-bento-ink px-2 py-px text-[11px] font-semibold">
              {label}
            </span>
          ) : null}
        </div>
        {report.targetText ? (
          <blockquote className="mt-2 border-l-4 border-bento-ink pl-3 text-[13px]">
            {report.targetText}
            {(report.targetKind === 'comment' && report.targetCommentStatus === null) ||
            (report.targetKind === 'why' && report.targetWhyStatus === null) ? (
              <span className="ml-2 font-mono text-[10px] uppercase text-admin-muted">
                supprimé depuis
              </span>
            ) : null}
            {report.targetCommentStatus === 'hidden' || report.targetWhyStatus === 'hidden' ? (
              <span className="ml-2 font-mono text-[10px] uppercase text-admin-muted">
                déjà masqué
              </span>
            ) : null}
          </blockquote>
        ) : null}
        {report.details ? (
          <p className="mt-1 text-[12px]">« {report.details} »</p>
        ) : report.reason ? (
          <p className="mt-1 text-[12px] text-admin-muted">{report.reason}</p>
        ) : !label ? (
          <p className="mt-1 text-[12px] italic text-admin-muted">(pas de motif fourni)</p>
        ) : null}
        <div className="mt-1 font-mono text-[10px] text-admin-muted">
          {dateTime(report.createdAt)}
          {' · par '}
          {report.reporterPseudo ? `@${report.reporterPseudo}` : 'un compte sans profil'}
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
      <div className="flex shrink-0 flex-wrap justify-end gap-2">
        {canHide ? (
          <button
            type="button"
            onClick={onHide}
            disabled={pending}
            className={`${buttonStrong} bg-bento-yellow`}
          >
            {report.targetKind === 'why' ? 'Masquer le pourquoi' : 'Masquer le commentaire'}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => run(() => dismissReport({ reportId: report.id }))}
          disabled={pending}
          className={buttonQuiet}
        >
          Classer sans suite
        </button>
        <button
          type="button"
          onClick={onBan}
          disabled={pending}
          className={`${buttonStrong} bg-bento-red text-bento-cream`}
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
        {report.status === 'reviewed' ? 'traité' : 'classé'}
      </span>
      <span className="font-mono text-[10px] uppercase text-admin-muted">
        {KINDS[report.targetKind]}
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

function CommentLine({
  comment,
  setError,
}: {
  comment: CommentRow;
  setError: (e: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  const hidden = comment.status === 'hidden';

  const onToggle = () => {
    if (hidden) {
      startTransition(async () => {
        const res = await restoreComment({ commentId: comment.id });
        setError(res.ok ? null : res.error);
      });
      return;
    }
    const reason = window.prompt(
      'Motif du masquage, que son auteur verra sous son commentaire :',
      'Contraire aux règles',
    );
    if (!reason?.trim()) return;
    startTransition(async () => {
      const res = await hideComment({ commentId: comment.id, reason: reason.trim() });
      setError(res.ok ? null : res.error);
    });
  };

  return (
    <div className={`flex items-start gap-4 px-4 py-3 ${hidden ? 'opacity-60' : ''}`}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <span className="font-semibold">@{comment.authorPseudo}</span>
          <span className="font-mono text-[10px] text-admin-muted">
            {dateTime(comment.createdAt)}
          </span>
          {comment.bento ? (
            <a
              href={publicBentoUrl(
                comment.bento.ownerPseudo ?? '',
                comment.bento.slug,
                comment.bento.isPrimary,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] underline text-admin-muted"
            >
              sous le bento de @{comment.bento.ownerPseudo ?? '?'} ↗
            </a>
          ) : null}
          {hidden ? (
            <span className="rounded-full border border-bento-ink px-2 py-px font-mono text-[9px] uppercase">
              masqué{comment.hiddenReason ? ` · ${comment.hiddenReason}` : ''}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-[13px]">{comment.body}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={pending}
        className={hidden ? buttonQuiet : `${buttonStrong} bg-bento-yellow`}
      >
        {hidden ? 'Rétablir' : 'Masquer'}
      </button>
    </div>
  );
}

function WhyLine({ why, setError }: { why: WhyRow; setError: (e: string | null) => void }) {
  const [pending, startTransition] = useTransition();
  const hidden = why.status === 'hidden';

  const onToggle = () => {
    if (hidden) {
      startTransition(async () => {
        const res = await restoreWhy({ whyId: why.id });
        setError(res.ok ? null : res.error);
      });
      return;
    }
    const reason = window.prompt(
      'Motif du masquage, que son auteur verra sous son pourquoi :',
      'Contraire aux règles',
    );
    if (!reason?.trim()) return;
    startTransition(async () => {
      const res = await hideWhy({ whyId: why.id, reason: reason.trim() });
      setError(res.ok ? null : res.error);
    });
  };

  return (
    <div className={`flex items-start gap-4 px-4 py-3 ${hidden ? 'opacity-60' : ''}`}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <span className="font-semibold">@{why.bento?.ownerPseudo ?? '?'}</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-admin-muted">
            {why.casePrompt}
            {why.itemTitle ? ` · ${why.itemTitle}` : ''}
          </span>
          <span className="font-mono text-[10px] text-admin-muted">{dateTime(why.updatedAt)}</span>
          {why.bento ? (
            <a
              href={publicBentoUrl(why.bento.ownerPseudo ?? '', why.bento.slug, why.bento.isPrimary)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] underline text-admin-muted"
            >
              voir le bento ↗
            </a>
          ) : null}
          {hidden ? (
            <span className="rounded-full border border-bento-ink px-2 py-px font-mono text-[9px] uppercase">
              masqué{why.hiddenReason ? ` · ${why.hiddenReason}` : ''}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-[13px]">« {why.body} »</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={pending}
        className={hidden ? buttonQuiet : `${buttonStrong} bg-bento-yellow`}
      >
        {hidden ? 'Rétablir' : 'Masquer'}
      </button>
    </div>
  );
}
