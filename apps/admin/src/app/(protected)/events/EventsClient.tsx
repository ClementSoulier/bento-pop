'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Field, FormGrid, Modal } from '@/components/Modal';
import { StatusBadge, type StatusKind } from '@/components/StatusBadge';
import { PencilIcon, PlusIcon, TrashIcon } from '@/components/icons';
import { formatDateBlock } from '@/lib/format';
import { clsx } from '@/lib/clsx';
import { saveEvent, deleteEvent, type EventFormPayload } from './actions';

export type EventRow = {
  id: string;
  date: string;
  title: string;
  place: string;
  stand: string;
  status: 'live' | 'soon' | 'done';
  status_label: string;
  replay_url: string | null;
  display_order: number;
};

type EventsClientProps = { events: EventRow[] };

export function EventsClient({ events }: EventsClientProps) {
  const [editing, setEditing] = useState<EventRow | 'new' | null>(null);

  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <p className="font-mono text-[12px] uppercase tracking-[0.1em] text-admin-muted">
          {events.length} fiche{events.length > 1 ? 's' : ''}
        </p>
        <button className="admin-btn admin-btn-primary" onClick={() => setEditing('new')}>
          <PlusIcon />
          Nouvel événement
        </button>
      </div>

      <div className="admin-card overflow-hidden">
        <table className="w-full text-left">
          <thead className="border-b border-admin-border bg-admin-surface-2">
            <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-admin-muted">
              <th className="px-4 py-2.5">Date</th>
              <th className="px-4 py-2.5">Événement</th>
              <th className="px-4 py-2.5">Stand</th>
              <th className="px-4 py-2.5">Statut</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-[13px] text-admin-muted">
                  Aucun événement. Crée le premier en cliquant sur « Nouvel événement ».
                </td>
              </tr>
            ) : (
              events.map((event) => {
                const d = formatDateBlock(event.date);
                return (
                  <tr key={event.id} className="border-b border-admin-border last:border-b-0 hover:bg-admin-bg/40">
                    <td className="px-4 py-3">
                      <div className="font-display text-[20px] leading-none">{d.day}</div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-admin-muted">
                        {d.month} {d.year}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[13px] font-semibold">{event.title}</div>
                      <div className="text-[12px] text-admin-muted">{event.place}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.1em] text-admin-muted">
                      {event.stand || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={event.status as StatusKind} label={event.status_label} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        title="Éditer"
                        onClick={() => setEditing(event)}
                        className="admin-btn admin-btn-sm admin-btn-ghost"
                      >
                        <PencilIcon />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <EventEditor
        open={editing !== null}
        event={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
      />
    </>
  );
}

const editSchema = z.object({
  title: z.string().trim().min(1, 'Titre requis'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date requise'),
  place: z.string().trim().min(1, 'Lieu requis'),
  stand: z.string().trim().default(''),
  status: z.enum(['live', 'soon', 'done']),
  replay_url: z.string().trim().url('URL invalide').or(z.literal('')).optional(),
  display_order: z.coerce.number().int().min(0).default(0),
});

type EditFormValues = z.infer<typeof editSchema>;

function EventEditor({
  open,
  event,
  onClose,
}: {
  open: boolean;
  event: EventRow | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    values: {
      title: event?.title ?? '',
      date: event?.date ?? '',
      place: event?.place ?? '',
      stand: event?.stand ?? '',
      status: event?.status ?? 'soon',
      replay_url: event?.replay_url ?? '',
      display_order: event?.display_order ?? 0,
    },
  });

  const status = watch('status');

  const onSubmit = (values: EditFormValues) => {
    setServerError(null);
    startTransition(async () => {
      const payload: EventFormPayload = {
        ...values,
        id: event?.id,
      };
      const result = await saveEvent(payload);
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
    if (!event) return;
    if (!confirm(`Supprimer définitivement « ${event.title} » ?`)) return;
    startTransition(async () => {
      const result = await deleteEvent(event.id);
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
      crumbs={event ? `Édition · ${event.title}` : 'Nouvel événement'}
      title={event ? event.title : 'Ajouter au Bento'}
      badge={event ? <StatusBadge status={event.status} /> : null}
      footer={
        <>
          {event ? (
            <button type="button" className="admin-btn admin-btn-danger mr-auto" onClick={onDelete} disabled={pending}>
              <TrashIcon />
              Supprimer
            </button>
          ) : null}
          <button type="button" className="admin-btn" onClick={onClose} disabled={pending}>
            Annuler
          </button>
          <button
            type="submit"
            form="event-form"
            className={clsx('admin-btn admin-btn-primary', pending && 'opacity-70')}
            disabled={pending}
          >
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <form id="event-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormGrid>
          <Field full label="Nom de l'événement" error={errors.title?.message}>
            <input className="admin-input" placeholder="Japan Expo, Paris Manga…" {...register('title')} />
          </Field>
          <Field label="Date" error={errors.date?.message}>
            <input className="admin-input" type="date" {...register('date')} />
          </Field>
          <Field label="Statut" error={errors.status?.message}>
            <select className="admin-select" {...register('status')}>
              <option value="soon">À venir</option>
              <option value="live">En direct</option>
              <option value="done">Terminé</option>
            </select>
          </Field>
          <Field full label="Lieu" error={errors.place?.message}>
            <input className="admin-input" placeholder="Paris Nord Villepinte" {...register('place')} />
          </Field>
          <Field full label="Stand · Plateau" error={errors.stand?.message}>
            <input className="admin-input" placeholder="Stand B-12 · Hall 7" {...register('stand')} />
          </Field>
          <Field
            full
            label="Lien YouTube replay"
            hint="Affiché uniquement quand le statut est « Terminé »."
            error={errors.replay_url?.message}
          >
            <input
              className="admin-input"
              type="url"
              placeholder="https://youtube.com/watch?v=…"
              disabled={status !== 'done'}
              {...register('replay_url')}
            />
          </Field>
          <Field label="Ordre d'affichage" hint="0 = premier" error={errors.display_order?.message}>
            <input className="admin-input" type="number" min={0} {...register('display_order')} />
          </Field>
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
