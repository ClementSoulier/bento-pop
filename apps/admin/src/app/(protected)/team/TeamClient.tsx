'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Field, FormGrid, Modal } from '@/components/Modal';
import { PencilIcon, PlusIcon, TrashIcon } from '@/components/icons';
import { PhotoUploader } from '@/components/PhotoUploader';
import { clsx } from '@/lib/clsx';
import { deleteMember, saveMember, type MemberFormPayload } from './actions';

export type MemberRow = {
  id: string;
  name: string;
  nick: string;
  bio: string;
  initials: string;
  photo_kind: 'gradient' | 'image';
  photo_from: string | null;
  photo_to: string | null;
  photo_url: string | null;
  rotation: number;
  display_order: number;
};

type Props = { members: MemberRow[] };

export function TeamClient({ members }: Props) {
  const [editing, setEditing] = useState<MemberRow | 'new' | null>(null);

  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <p className="font-mono text-[12px] uppercase tracking-[0.1em] text-admin-muted">
          {members.length} membre{members.length > 1 ? 's' : ''}
        </p>
        <button className="admin-btn admin-btn-primary" onClick={() => setEditing('new')}>
          <PlusIcon />
          Ajouter un membre
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {members.map((m) => (
          <article key={m.id} className="admin-card overflow-hidden">
            <div
              className="grid aspect-square place-items-center"
              style={
                m.photo_kind === 'image' && m.photo_url
                  ? { backgroundImage: `url(${m.photo_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                  : {
                      background: `linear-gradient(135deg, ${m.photo_from ?? '#2a3142'} 0%, ${m.photo_to ?? '#4a5266'} 100%)`,
                    }
              }
            >
              {m.photo_kind === 'gradient' || !m.photo_url ? (
                <span
                  className="font-display text-[64px] leading-none text-bento-cream/95"
                  style={{ textShadow: '0 4px 0 rgba(0,0,0,0.25)' }}
                >
                  {m.initials}
                </span>
              ) : null}
            </div>
            <div className="p-4">
              <div className="font-display text-[20px] leading-none">{m.name}</div>
              <div className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.15em] text-bento-red">
                {m.nick}
              </div>
              <p className="mt-2 line-clamp-3 text-[12px] text-admin-ink-2">{m.bio}</p>
              <button
                type="button"
                className="admin-btn admin-btn-sm admin-btn-ghost mt-3 w-full"
                onClick={() => setEditing(m)}
              >
                <PencilIcon />
                Éditer
              </button>
            </div>
          </article>
        ))}
      </div>

      <MemberEditor
        open={editing !== null}
        member={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
      />
    </>
  );
}

const editSchema = z.object({
  name: z.string().trim().min(1),
  nick: z.string().trim().min(1),
  bio: z.string().trim().max(500),
  initials: z.string().trim().min(1).max(4),
  photo_kind: z.enum(['gradient', 'image']),
  photo_from: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'HEX requis (ex: #2a3142)').optional().or(z.literal('')),
  photo_to: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'HEX requis').optional().or(z.literal('')),
  photo_url: z.string().trim().url('URL invalide').or(z.literal('')).optional(),
  rotation: z.coerce.number().min(-15).max(15),
  display_order: z.coerce.number().int().min(0),
});

type EditFormValues = z.infer<typeof editSchema>;

function MemberEditor({
  open,
  member,
  onClose,
}: {
  open: boolean;
  member: MemberRow | null;
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
    setValue,
    formState: { errors },
  } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    values: {
      name: member?.name ?? '',
      nick: member?.nick ?? '',
      bio: member?.bio ?? '',
      initials: member?.initials ?? '',
      photo_kind: member?.photo_kind ?? 'gradient',
      photo_from: member?.photo_from ?? '#2a3142',
      photo_to: member?.photo_to ?? '#4a5266',
      photo_url: member?.photo_url ?? '',
      rotation: member?.rotation ?? 0,
      display_order: member?.display_order ?? 0,
    },
  });
  const photoKind = watch('photo_kind');
  const photoUrl = watch('photo_url');

  const onSubmit = (values: EditFormValues) => {
    setServerError(null);
    startTransition(async () => {
      const payload: MemberFormPayload = { ...values, id: member?.id };
      const result = await saveMember(payload);
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
    if (!member) return;
    if (!confirm(`Supprimer ${member.name} de la team ?`)) return;
    startTransition(async () => {
      const result = await deleteMember(member.id);
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
      crumbs={member ? `Édition · ${member.name}` : 'Nouveau membre'}
      title={member ? member.name : 'Ajouter un membre'}
      footer={
        <>
          {member ? (
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
            form="team-form"
            className={clsx('admin-btn admin-btn-primary', pending && 'opacity-70')}
            disabled={pending}
          >
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <form id="team-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormGrid>
          <Field label="Prénom / nom de scène" error={errors.name?.message}>
            <input className="admin-input" placeholder="Dark Hifus" {...register('name')} />
          </Field>
          <Field label="Surnom" error={errors.nick?.message}>
            <input className="admin-input" placeholder="Le Captain" {...register('nick')} />
          </Field>
          <Field full label="Bio" error={errors.bio?.message}>
            <textarea className="admin-textarea" rows={3} {...register('bio')} />
          </Field>
          <Field label="Initiales" hint="2 lettres affichées sur le visuel" error={errors.initials?.message}>
            <input className="admin-input" maxLength={4} placeholder="DH" {...register('initials')} />
          </Field>
          <Field label="Type de visuel" error={errors.photo_kind?.message}>
            <select className="admin-select" {...register('photo_kind')}>
              <option value="gradient">Dégradé + initiales</option>
              <option value="image">Photo</option>
            </select>
          </Field>
          {photoKind === 'gradient' ? (
            <>
              <Field label="Couleur début" error={errors.photo_from?.message}>
                <input className="admin-input font-mono" placeholder="#2a3142" {...register('photo_from')} />
              </Field>
              <Field label="Couleur fin" error={errors.photo_to?.message}>
                <input className="admin-input font-mono" placeholder="#4a5266" {...register('photo_to')} />
              </Field>
            </>
          ) : (
            <>
              <Field full label="Photo">
                <PhotoUploader
                  currentUrl={photoUrl || null}
                  bucket="team-photos"
                  pathPrefix=""
                  onUploaded={(url) => {
                    setValue('photo_url', url, { shouldDirty: true });
                    setValue('photo_kind', 'image', { shouldDirty: true });
                  }}
                />
              </Field>
              <Field
                full
                label="URL (avancé)"
                hint="Téléverse une image avec le bouton ci-dessus, ou colle une URL externe."
                error={errors.photo_url?.message}
              >
                <input
                  className="admin-input font-mono text-[12px]"
                  type="url"
                  placeholder="https://…/dark-hifus.jpg"
                  {...register('photo_url')}
                />
              </Field>
            </>
          )}
          <Field label="Rotation polaroid" hint="-15 à +15 degrés" error={errors.rotation?.message}>
            <input className="admin-input" type="number" step="0.5" min={-15} max={15} {...register('rotation')} />
          </Field>
          <Field label="Ordre" hint="0 = premier" error={errors.display_order?.message}>
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
