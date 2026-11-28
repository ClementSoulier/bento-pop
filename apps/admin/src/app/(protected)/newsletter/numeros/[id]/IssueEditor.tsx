'use client';

import { useDeferredValue, useEffect, useMemo, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/Modal';
import { TrashIcon } from '@/components/icons';
import { IssueStatusBadge } from '@/components/newsletter/IssueStatusBadge';
import { clsx } from '@/lib/clsx';
import { datetimeLocalToIso } from '@/lib/episodes/format';
import { formatNumber } from '@/lib/format';
import {
  PREHEADER_MAX,
  SUBJECT_MAX,
  UNSUBSCRIBE_MARKER,
  byteLength,
  checkIssue,
  checkSchedule,
  formatParisDate,
  hasBlockingError,
  renderIssue,
  type IssueContent,
} from '@/lib/newsletter/issue';
import type { IssueRow } from '@/lib/newsletter/issues';
import {
  cancelIssue,
  deleteIssue,
  prepareSend,
  retrySend,
  saveIssue,
  sendIssue,
  sendTestIssue,
} from '../actions';

type Notice = { kind: 'ok' | 'error'; text: string } | null;

type Props = {
  issue: IssueRow | null;
  /** L'adresse de l'admin connecté : la destination du test par défaut. */
  defaultTestEmail: string;
  /** Les variables de Resend sont posées : test et envoi possibles. */
  configured: boolean;
  /** Inscrits à l'ouverture de la page ; le nombre exact se calcule à l'envoi. */
  subscribers: number;
  /** Où mène `{{desinscription}}` dans l'aperçu et le test. */
  testUnsubscribeUrl: string;
};

const EMPTY: IssueContent = { subject: '', preheader: '', html: '', text: '' };

export function IssueEditor({ issue, defaultTestEmail, configured, subscribers, testUnsubscribeUrl }: Props) {
  const router = useRouter();
  const initial: IssueContent = issue
    ? { subject: issue.subject, preheader: issue.preheader, html: issue.html, text: issue.text }
    : EMPTY;
  const [saved, setSaved] = useState<IssueContent>(initial);
  const [content, setContent] = useState<IssueContent>(initial);
  const [saveNotice, setSaveNotice] = useState<Notice>(null);
  const [testNotice, setTestNotice] = useState<Notice>(null);
  const [sendNotice, setSendNotice] = useState<Notice>(null);
  const [testEmail, setTestEmail] = useState(defaultTestEmail);
  const [mode, setMode] = useState<'now' | 'later'>('now');
  const [scheduleLocal, setScheduleLocal] = useState('');
  const [confirm, setConfirm] = useState<{ recipients: number; scheduledAt: string | null } | null>(null);
  const [width, setWidth] = useState<600 | 375>(600);
  const [saving, startSave] = useTransition();
  const [testing, startTest] = useTransition();
  const [sending, startSend] = useTransition();

  const status = issue?.status ?? 'draft';
  const editable = status === 'draft';
  const dirty = (Object.keys(EMPTY) as Array<keyof IssueContent>).some((k) => content[k] !== saved[k]);
  const checks = useMemo(() => checkIssue(content), [content]);
  const blocked = hasBlockingError(checks);
  const htmlBytes = useMemo(() => byteLength(content.html), [content.html]);

  // L'aperçu suit la saisie sans la ralentir : un HTML de 50 Ko se rend en différé.
  const previewSource = useDeferredValue(content);
  const preview = useMemo(
    () => renderIssue(previewSource, testUnsubscribeUrl).html,
    [previewSource, testUnsubscribeUrl],
  );

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const set = (key: keyof IssueContent) => (value: string) => setContent((c) => ({ ...c, [key]: value }));

  const save = () =>
    startSave(async () => {
      setSaveNotice(null);
      const res = await saveIssue({ id: issue?.id, ...content });
      if (!res.ok) {
        setSaveNotice({ kind: 'error', text: res.error });
        return;
      }
      setSaved(content);
      if (!issue) {
        router.replace(`/newsletter/numeros/${res.id}`);
        return;
      }
      setSaveNotice({ kind: 'ok', text: 'Enregistré.' });
      router.refresh();
    });

  const remove = () => {
    if (!issue || !window.confirm('Effacer ce brouillon ? Il ne pourra pas être récupéré.')) return;
    startSave(async () => {
      const res = await deleteIssue(issue.id);
      if (!res.ok) {
        setSaveNotice({ kind: 'error', text: res.error });
        return;
      }
      router.push('/newsletter/numeros');
    });
  };

  const sendTest = () =>
    startTest(async () => {
      if (!issue) return;
      setTestNotice(null);
      const res = await sendTestIssue(issue.id, testEmail);
      setTestNotice(
        res.ok
          ? { kind: 'ok', text: `Test envoyé à ${res.to}. Il compte dans les 100 mails du jour du plan gratuit.` }
          : { kind: 'error', text: res.error },
      );
    });

  const askSend = () =>
    startSend(async () => {
      if (!issue) return;
      setSendNotice(null);
      let scheduledAt: string | null = null;
      if (mode === 'later') {
        scheduledAt = datetimeLocalToIso(scheduleLocal);
        const scheduleError = scheduledAt ? checkSchedule(scheduledAt) : 'Choisir la date et l’heure de l’envoi.';
        if (scheduleError) {
          setSendNotice({ kind: 'error', text: scheduleError });
          return;
        }
      }
      const res = await prepareSend(issue.id);
      if (!res.ok) {
        setSendNotice({ kind: 'error', text: res.error });
        return;
      }
      setConfirm({ recipients: res.recipients, scheduledAt });
    });

  const doSend = () =>
    startSend(async () => {
      if (!issue || !confirm) return;
      const res = await sendIssue(issue.id, confirm.scheduledAt, confirm.recipients);
      setConfirm(null);
      if (!res.ok) setSendNotice({ kind: 'error', text: res.error });
      router.refresh();
    });

  const followUp = (action: typeof cancelIssue, question?: string) => () => {
    if (!issue || (question && !window.confirm(question))) return;
    startSend(async () => {
      setSendNotice(null);
      const res = await action(issue.id);
      if (!res.ok) setSendNotice({ kind: 'error', text: res.error });
      router.refresh();
    });
  };

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-4">
        <section className="admin-card space-y-4 p-5" aria-label="Contenu du numéro">
          <TextField
            label="Objet"
            value={content.subject}
            onChange={set('subject')}
            max={SUBJECT_MAX}
            readOnly={!editable}
            placeholder="Des openings en japonais, 1000 ans de manga et Toulouse ce week-end !"
          />
          <TextField
            label="Texte d’aperçu"
            value={content.preheader}
            onChange={set('preheader')}
            max={PREHEADER_MAX}
            readOnly={!editable}
            placeholder="La ligne affichée après l’objet dans la boîte de réception"
            hint="Glissé, invisible, en tête du mail. Laisser vide si le HTML a déjà son bloc d’aperçu."
          />
          <label className="block">
            <span className="mb-2 flex justify-between text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
              <span>Contenu HTML</span>
              <span className={clsx('font-mono', htmlBytes > 100_000 && 'text-bento-red')}>
                {formatNumber(Math.round(htmlBytes / 100) / 10)} Ko
              </span>
            </span>
            <textarea
              className="admin-textarea font-mono text-[12px]"
              rows={16}
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              readOnly={!editable}
              value={content.html}
              onChange={(e) => set('html')(e.target.value)}
              placeholder="<!DOCTYPE html>…"
            />
            <span className="mt-1.5 block text-[11px] text-admin-muted">
              Envoyé tel quel. Le repère <code>{UNSUBSCRIBE_MARKER}</code> devient le lien de désinscription
              personnel de chaque inscrit.
            </span>
          </label>
          <label className="block">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
              Version texte brut
            </span>
            <textarea
              className="admin-textarea font-mono text-[12px]"
              rows={8}
              readOnly={!editable}
              value={content.text}
              onChange={(e) => set('text')(e.target.value)}
              placeholder={`Le même numéro, en texte seul, avec ${UNSUBSCRIBE_MARKER} à la fin.`}
            />
          </label>
        </section>

        <section className="admin-card p-5" aria-label="Aperçu du rendu">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-admin-muted">Aperçu</h2>
            <div className="flex gap-2" role="group" aria-label="Largeur de l’aperçu">
              {([600, 375] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  aria-pressed={width === w}
                  onClick={() => setWidth(w)}
                  className={clsx('admin-btn admin-btn-sm', width === w && 'admin-btn-primary')}
                >
                  {w === 600 ? 'Ordinateur' : 'Mobile'}
                </button>
              ))}
            </div>
          </div>
          {content.html.trim() ? (
            <div className="overflow-x-auto rounded-admin-input border border-admin-border bg-admin-bg p-3">
              <iframe
                title="Aperçu du numéro"
                sandbox=""
                srcDoc={preview}
                className="mx-auto block h-[900px] bg-white"
                style={{ width }}
              />
            </div>
          ) : (
            <p className="py-10 text-center text-[13px] text-admin-muted">
              Le rendu s’affiche ici dès que le contenu HTML est collé.
            </p>
          )}
          <p className="mt-2 text-[11px] text-admin-muted">
            Rendu du navigateur, sans script. Les messageries affichent parfois autrement : l’envoi de test
            fait foi.
          </p>
        </section>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-[88px]">
        <Panel title="Statut">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <IssueStatusBadge status={status} />
            {dirty ? (
              <span className="text-[11px] text-admin-muted">Modifications non enregistrées</span>
            ) : null}
          </div>
          {issue && status !== 'draft' ? <Delivery issue={issue} /> : null}
          {/* Une erreur toute fraîche (sendNotice) dit la même chose, en plus précis. */}
          {issue?.last_error && status !== 'sent' && !sendNotice ? (
            <NoticeBox notice={{ kind: 'error', text: issue.last_error }} />
          ) : null}
          {editable ? (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="admin-btn admin-btn-primary flex-1"
                onClick={save}
                disabled={saving || (!dirty && Boolean(issue))}
              >
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              {issue ? (
                <button type="button" className="admin-btn" onClick={remove} disabled={saving}>
                  <TrashIcon />
                  Effacer
                </button>
              ) : null}
            </div>
          ) : null}
          {status === 'scheduled' ? (
            <button
              type="button"
              className="admin-btn mt-3 w-full"
              onClick={followUp(cancelIssue, 'Annuler la programmation ? Le numéro redevient brouillon.')}
              disabled={sending}
            >
              Annuler la programmation
            </button>
          ) : null}
          {status === 'sending' && issue?.last_error ? (
            <div className="mt-3 flex gap-2">
              <button type="button" className="admin-btn admin-btn-primary flex-1" onClick={followUp(retrySend)} disabled={sending}>
                Réessayer
              </button>
              <button
                type="button"
                className="admin-btn"
                onClick={followUp(cancelIssue, 'Annuler cet envoi ? Le numéro redevient brouillon.')}
                disabled={sending}
              >
                Annuler
              </button>
            </div>
          ) : null}
          <NoticeBox notice={saveNotice} />
          {!editable ? <NoticeBox notice={sendNotice} /> : null}
        </Panel>

        <Panel title="Contrôles">
          {checks.length === 0 ? (
            <p className="text-[12px] text-admin-muted">Rien à signaler.</p>
          ) : (
            <ul className="space-y-2">
              {checks.map((c) => (
                <li
                  key={c.message}
                  className={clsx(
                    'rounded-admin-input border px-3 py-2 text-[12px]',
                    c.level === 'error'
                      ? 'border-admin-border bg-admin-red-soft text-bento-red'
                      : 'border-admin-border bg-admin-bg',
                  )}
                >
                  <strong className="font-semibold">{c.level === 'error' ? 'Bloquant' : 'À vérifier'} :</strong>{' '}
                  {c.message}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {!configured ? (
          <Panel title="Envoi">
            <p className="text-[12px] text-admin-muted">
              L’envoi n’est pas encore branché : il attend <code>RESEND_NEWSLETTER_API_KEY</code> et{' '}
              <code>RESEND_NEWSLETTER_SEGMENT_ID</code> sur l’app back-office (Coolify, variables runtime).
            </p>
          </Panel>
        ) : (
          <>
            <Panel title="Envoi de test">
              <label className="block">
                <span className="sr-only">Adresse du test</span>
                <input
                  type="email"
                  className="admin-input"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  autoComplete="email"
                />
              </label>
              <button
                type="button"
                className="admin-btn mt-2 w-full"
                onClick={sendTest}
                disabled={!issue || dirty || testing}
                title={!issue || dirty ? 'Enregistrer d’abord : le test part de la version enregistrée' : undefined}
              >
                {testing ? 'Envoi du test…' : 'Envoyer le test'}
              </button>
              <p className="mt-2 text-[11px] text-admin-muted">
                Objet précédé de « [Test] » ; le lien de désinscription y mène à la page Confidentialité.
              </p>
              <NoticeBox notice={testNotice} />
            </Panel>

            {editable ? (
              <Panel title="Envoyer aux inscrits">
                <fieldset className="space-y-2">
                  <legend className="sr-only">Quand</legend>
                  <label className="flex items-center gap-2 text-[13px]">
                    <input type="radio" name="mode" checked={mode === 'now'} onChange={() => setMode('now')} />
                    Maintenant
                  </label>
                  <label className="flex items-center gap-2 text-[13px]">
                    <input type="radio" name="mode" checked={mode === 'later'} onChange={() => setMode('later')} />
                    Programmer (heure de Paris)
                  </label>
                  {mode === 'later' ? (
                    <input
                      type="datetime-local"
                      className="admin-input"
                      aria-label="Date et heure de l’envoi"
                      value={scheduleLocal}
                      onChange={(e) => setScheduleLocal(e.target.value)}
                    />
                  ) : null}
                </fieldset>
                <button
                  type="button"
                  className="admin-btn admin-btn-accent mt-3 w-full"
                  onClick={askSend}
                  disabled={!issue || dirty || blocked || sending}
                  title={
                    !issue || dirty
                      ? 'Enregistrer d’abord : l’envoi part de la version enregistrée'
                      : blocked
                        ? 'Corriger d’abord les points bloquants'
                        : undefined
                  }
                >
                  {sending ? 'Préparation…' : mode === 'later' ? 'Programmer l’envoi…' : 'Envoyer aux inscrits…'}
                </button>
                <p className="mt-2 text-[11px] text-admin-muted">
                  {formatNumber(subscribers)} inscrit{subscribers > 1 ? 's' : ''} à l’ouverture de la page.
                  Le nombre exact s’affiche avant de confirmer.
                </p>
                <NoticeBox notice={sendNotice} />
              </Panel>
            ) : null}
          </>
        )}
      </aside>

      <Modal
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open && !sending) setConfirm(null);
        }}
        crumbs="Newsletter · Envoi"
        title={confirm?.scheduledAt ? 'Programmer l’envoi' : 'Envoyer aux inscrits'}
        footer={
          <>
            <button type="button" className="admin-btn" onClick={() => setConfirm(null)} disabled={sending}>
              Annuler
            </button>
            <button type="button" className="admin-btn admin-btn-accent" onClick={doSend} disabled={sending}>
              {sending ? 'Envoi…' : confirm?.scheduledAt ? 'Programmer' : 'Envoyer maintenant'}
            </button>
          </>
        }
      >
        {confirm ? (
          <div className="space-y-3 text-[14px]">
            <p>
              {confirm.scheduledAt ? 'Programmer' : 'Envoyer'} « <strong>{content.subject}</strong> » à{' '}
              <strong>
                {formatNumber(confirm.recipients)} inscrit{confirm.recipients > 1 ? 's' : ''}
              </strong>
              {confirm.scheduledAt ? (
                <>
                  {' '}
                  pour le <strong>{formatParisDate(confirm.scheduledAt)}</strong>
                </>
              ) : null}{' '}
              ?
            </p>
            <p className="text-[12px] text-admin-muted">
              Un mail par inscrit, jamais de liste en copie. Une fois parti, ce numéro ne peut plus repartir.
              {confirm.scheduledAt ? ' La programmation reste annulable jusqu’à l’heure dite.' : ''}
            </p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="admin-card p-4" aria-label={title}>
      <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.12em] text-admin-muted">{title}</h2>
      {children}
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  max,
  readOnly,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  max: number;
  readOnly: boolean;
  placeholder: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex justify-between text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
        <span>{label}</span>
        <span className={clsx('font-mono', value.length > max && 'text-bento-red')}>
          {value.length}/{max}
        </span>
      </span>
      <input
        className="admin-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        placeholder={placeholder}
      />
      {hint ? <span className="mt-1.5 block text-[11px] text-admin-muted">{hint}</span> : null}
    </label>
  );
}

function Delivery({ issue }: { issue: IssueRow }) {
  const lines: Array<[string, string]> = [];
  if (issue.status === 'scheduled') lines.push(['Programmé pour', formatParisDate(issue.scheduled_at)]);
  if (issue.sent_at) lines.push(['Parti le', formatParisDate(issue.sent_at)]);
  if (issue.recipients !== null) lines.push(['Destinataires', formatNumber(issue.recipients)]);
  if (issue.status !== 'scheduled') {
    lines.push(['Mails partis', formatNumber(issue.delivered)]);
    lines.push(['Rebonds', formatNumber(issue.bounces)]);
    lines.push(['Plaintes', formatNumber(issue.complaints)]);
  }
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]">
      {lines.map(([term, value]) => (
        <div key={term} className="contents">
          <dt className="text-admin-muted">{term}</dt>
          <dd className="text-right font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function NoticeBox({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return (
    <div
      role={notice.kind === 'error' ? 'alert' : 'status'}
      className={clsx(
        'mt-3 rounded-admin-input border border-admin-border px-3 py-2 text-[12px]',
        notice.kind === 'error' ? 'bg-admin-red-soft text-bento-red' : 'bg-admin-bg',
      )}
    >
      {notice.text}
    </div>
  );
}
