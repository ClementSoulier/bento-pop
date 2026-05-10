'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Field, FormGrid, Modal } from '@/components/Modal';
import { StatusBadge, type StatusKind } from '@/components/StatusBadge';
import { PencilIcon, PlusIcon, TrashIcon } from '@/components/icons';
import { formatNumber } from '@/lib/format';
import { clsx } from '@/lib/clsx';
import { archivePoll, deletePoll, publishPoll, savePoll, type PollFormPayload } from './actions';

export type PollOption = { id: string; label: string };
export type PollRow = {
  id: string;
  week_tag: string;
  question: string;
  options: PollOption[];
  ends_at: string;
  is_current: boolean;
  total_votes: number;
};

type PollsClientProps = { polls: PollRow[] };

function statusOf(p: PollRow): StatusKind {
  if (p.is_current) return 'live';
  return new Date(p.ends_at).getTime() < Date.now() ? 'archived' : 'draft';
}

export function PollsClient({ polls }: PollsClientProps) {
  const [editing, setEditing] = useState<PollRow | 'new' | null>(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleAction = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) alert(result.error ?? 'Erreur serveur');
      router.refresh();
    });

  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <p className="font-mono text-[12px] uppercase tracking-[0.1em] text-admin-muted">
          {polls.length} sondage{polls.length > 1 ? 's' : ''}
        </p>
        <button className="admin-btn admin-btn-primary" onClick={() => setEditing('new')}>
          <PlusIcon />
          Nouveau sondage
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {polls.length === 0 ? (
          <div className="admin-card p-12 text-center text-[13px] text-admin-muted">
            Aucun sondage encore. Crée le premier brouillon.
          </div>
        ) : (
          polls.map((poll) => {
            const status = statusOf(poll);
            const total = poll.total_votes;
            return (
              <article key={poll.id} className="admin-card p-4">
                <header className="flex items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-admin-muted">
                      {poll.week_tag}
                    </div>
                    <h3 className="mt-0.5 truncate text-[15px] font-semibold">{poll.question}</h3>
                    <div className="mt-1 font-mono text-[11px] text-admin-muted">
                      Clôture {new Date(poll.ends_at).toLocaleString('fr-FR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })} · {formatNumber(total)} vote{total > 1 ? 's' : ''}
                    </div>
                  </div>
                  <StatusBadge status={status} />
                </header>

                <ul className="mt-3 grid grid-cols-2 gap-2">
                  {poll.options.map((opt, i) => (
                    <li
                      key={opt.id}
                      className="flex items-center gap-2 rounded-admin-input border border-admin-border bg-admin-surface-2 px-2.5 py-1.5 text-[12px]"
                    >
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-admin-ink text-[10px] font-bold text-bento-cream">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="truncate">{opt.label}</span>
                    </li>
                  ))}
                </ul>

                <footer className="mt-4 flex items-center justify-end gap-2">
                  {status !== 'live' ? (
                    <button
                      type="button"
                      className="admin-btn admin-btn-sm admin-btn-accent"
                      disabled={pending}
                      onClick={() => handleAction(() => publishPoll(poll.id))}
                    >
                      Publier
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="admin-btn admin-btn-sm"
                      disabled={pending}
                      onClick={() => handleAction(() => archivePoll(poll.id))}
                    >
                      Archiver
                    </button>
                  )}
                  <button
                    type="button"
                    className="admin-btn admin-btn-sm admin-btn-ghost"
                    onClick={() => setEditing(poll)}
                  >
                    <PencilIcon />
                    Éditer
                  </button>
                </footer>
              </article>
            );
          })
        )}
      </div>

      <PollEditor
        open={editing !== null}
        poll={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
      />
    </>
  );
}

const optionSchema = z.object({
  id: z.string().trim().min(1, 'Slug requis'),
  label: z.string().trim().min(1, 'Libellé requis'),
});
const editSchema = z.object({
  week_tag: z.string().trim().min(1, 'Tag requis'),
  question: z.string().trim().min(1, 'Question requise'),
  options: z.array(optionSchema).min(2).max(8),
  ends_at: z.string().min(1, 'Date requise'),
});

type EditFormValues = z.infer<typeof editSchema>;

function PollEditor({
  open,
  poll,
  onClose,
}: {
  open: boolean;
  poll: PollRow | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    values: {
      week_tag: poll?.week_tag ?? `Vote · Semaine ${new Date().getUTCDate()}`,
      question: poll?.question ?? '',
      options: poll?.options ?? [
        { id: 'a', label: '' },
        { id: 'b', label: '' },
      ],
      ends_at: poll?.ends_at?.slice(0, 16) ?? '',
    },
  });
  const { fields, append, remove } = useFieldArray({ name: 'options', control });

  const onSubmit = (values: EditFormValues) => {
    setServerError(null);
    startTransition(async () => {
      const payload: PollFormPayload = {
        ...values,
        id: poll?.id,
        ends_at: new Date(values.ends_at).toISOString(),
      };
      const result = await savePoll(payload);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      reset();
      onClose();
      router.refresh();
    });
  };

  const onDelete = () => {
    if (!poll) return;
    if (!confirm(`Supprimer définitivement « ${poll.question} » ?`)) return;
    startTransition(async () => {
      const result = await deletePoll(poll.id);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      onClose();
      router.refresh();
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      crumbs={poll ? `Édition · ${poll.week_tag}` : 'Nouveau sondage'}
      title={poll ? poll.question : 'Préparer un vote'}
      footer={
        <>
          {poll ? (
            <button
              type="button"
              className="admin-btn admin-btn-danger mr-auto"
              onClick={onDelete}
              disabled={pending}
            >
              <TrashIcon />
              Supprimer
            </button>
          ) : null}
          <button type="button" className="admin-btn" onClick={onClose} disabled={pending}>
            Annuler
          </button>
          <button
            type="submit"
            form="poll-form"
            className={clsx('admin-btn admin-btn-primary', pending && 'opacity-70')}
            disabled={pending}
          >
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <form id="poll-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormGrid>
          <Field label="Tag" hint="Affiché en pastille rouge" error={errors.week_tag?.message}>
            <input className="admin-input" placeholder="Vote · Semaine 19" {...register('week_tag')} />
          </Field>
          <Field label="Clôture" error={errors.ends_at?.message}>
            <input className="admin-input" type="datetime-local" {...register('ends_at')} />
          </Field>
          <Field full label="Question" error={errors.question?.message}>
            <input
              className="admin-input"
              placeholder="Quel jeu mérite le titre de GOTY 2026 ?"
              {...register('question')}
            />
          </Field>
          <div className="col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
                Options ({fields.length})
              </span>
              <button
                type="button"
                className="admin-btn admin-btn-sm"
                disabled={fields.length >= 8}
                onClick={() => append({ id: `opt${fields.length + 1}`, label: '' })}
              >
                <PlusIcon />
                Ajouter
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {fields.map((field, i) => (
                <div key={field.id} className="grid grid-cols-[80px_1fr_auto] gap-2">
                  <input
                    className="admin-input font-mono text-[12px]"
                    placeholder="slug"
                    {...register(`options.${i}.id` as const)}
                  />
                  <input
                    className="admin-input"
                    placeholder={`Option ${String.fromCharCode(65 + i)}`}
                    {...register(`options.${i}.label` as const)}
                  />
                  <button
                    type="button"
                    className="admin-btn admin-btn-sm admin-btn-ghost"
                    title="Retirer"
                    disabled={fields.length <= 2}
                    onClick={() => remove(i)}
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
            </div>
            {errors.options ? (
              <p className="mt-2 text-[11px] text-bento-red">
                {errors.options.message ?? errors.options.root?.message ?? 'Vérifie les options.'}
              </p>
            ) : null}
          </div>
        </FormGrid>
        {serverError ? (
          <div className="mt-4 rounded-admin-input border border-admin-border bg-admin-red-soft px-3 py-2 text-[12px] text-bento-red">
            {serverError}
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
