'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Field, FormGrid, Modal } from '@/components/Modal';
import { StatusBadge } from '@/components/StatusBadge';
import { PencilIcon, PlusIcon, TrashIcon } from '@/components/icons';
import { AudioField } from '@/components/episodes/AudioField';
import { ChaptersField } from '@/components/episodes/ChaptersField';
import { GuestsField } from '@/components/episodes/GuestsField';
import { HostsField, type TeamMemberOption } from '@/components/episodes/HostsField';
import { MentionsField } from '@/components/episodes/MentionsField';
import { SlugField } from '@/components/episodes/SlugField';
import {
  datetimeLocalToIso,
  isoToDatetimeLocal,
  secondsToTimecode,
  timecodeToSeconds,
} from '@/lib/episodes/format';
import {
  showEpisodeSchema,
  type EpisodeChapter,
  type EpisodeGuest,
  type EpisodeMention,
  type ShowEpisodePayload,
} from '@/lib/episodes/schemas';
import { slugify } from '@/lib/slugify';
import { clsx } from '@/lib/clsx';
import { deleteShowEpisode, saveShowEpisode } from './actions';

export type ShowEpisodeRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  youtube_id: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  published_at: string | null;
  season: number;
  episode_number: number | null;
  status: 'draft' | 'published';
  display_order: number;
  seo_title: string | null;
  seo_description: string | null;
  guests: EpisodeGuest[];
  mentions: EpisodeMention[];
  chapters: EpisodeChapter[];
  host_ids: string[];
  audio_url: string;
  audio_bytes: number;
  audio_mime: string;
  audio_published_at: string | null;
  feed_guid: string | null;
  feed_season: number | null;
  feed_number: number | null;
  explicit: boolean;
  episode_type: 'full' | 'trailer' | 'bonus';
  audio_title: string;
  audio_description: string;
  audio_image_url: string;
};

type EmissionsClientProps = {
  episodes: ShowEpisodeRow[];
  team: TeamMemberOption[];
};

const STATUS_FILTERS = [
  { value: 'all', label: 'Tous' },
  { value: 'published', label: 'Publiés' },
  { value: 'draft', label: 'Brouillons' },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]['value'];

export function EmissionsClient({ episodes, team }: EmissionsClientProps) {
  const [editing, setEditing] = useState<ShowEpisodeRow | 'new' | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return episodes;
    return episodes.filter((e) => e.status === statusFilter);
  }, [episodes, statusFilter]);

  const teamById = useMemo(() => new Map(team.map((m) => [m.id, m])), [team]);

  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              className={clsx(
                'admin-btn admin-btn-sm',
                statusFilter === f.value && 'admin-btn-primary',
              )}
              onClick={() => setStatusFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button className="admin-btn admin-btn-primary" onClick={() => setEditing('new')}>
          <PlusIcon />
          Nouvel épisode
        </button>
      </div>

      <div className="admin-card overflow-hidden">
        <table className="w-full text-left">
          <thead className="border-b border-admin-border bg-admin-surface-2">
            <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-admin-muted">
              <th className="px-4 py-2.5">N°</th>
              <th className="px-4 py-2.5">Titre</th>
              <th className="px-4 py-2.5">Animateurs</th>
              <th className="px-4 py-2.5">Durée</th>
              <th className="px-4 py-2.5">Publié</th>
              <th className="px-4 py-2.5">Statut</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-[13px] text-admin-muted">
                  Aucun épisode.
                </td>
              </tr>
            ) : (
              filtered.map((ep) => (
                <tr
                  key={ep.id}
                  className="border-b border-admin-border last:border-b-0 hover:bg-admin-bg/40"
                >
                  <td className="px-4 py-3 font-mono text-[12px] text-admin-muted">
                    S{ep.season}
                    {ep.episode_number != null ? ` · E${ep.episode_number}` : ''}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-[13px] font-semibold">{ep.title}</div>
                    <div className="font-mono text-[11px] text-admin-muted">/{ep.slug}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {ep.host_ids.length === 0 ? (
                        <span className="text-[11px] text-admin-muted">—</span>
                      ) : (
                        ep.host_ids.map((id) => {
                          const m = teamById.get(id);
                          return (
                            <span
                              key={id}
                              className="rounded-full border border-admin-border bg-admin-surface-2 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-admin-ink-2"
                            >
                              {m?.nick ?? '?'}
                            </span>
                          );
                        })
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px] text-admin-muted">
                    {secondsToTimecode(ep.duration_seconds) || '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-admin-muted">
                    {ep.published_at
                      ? new Date(ep.published_at).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          year: '2-digit',
                        })
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      status={ep.status === 'published' ? 'live' : 'draft'}
                      label={ep.status === 'published' ? 'Publié' : 'Brouillon'}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="admin-btn admin-btn-sm admin-btn-ghost"
                      onClick={() => setEditing(ep)}
                    >
                      <PencilIcon />
                      Éditer
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ShowEpisodeEditor
        open={editing !== null}
        episode={editing === 'new' ? null : editing}
        team={team}
        onClose={() => setEditing(null)}
      />
    </>
  );
}

// ============================================================
// Editor
// ============================================================

type EditFormValues = ShowEpisodePayload;

function ShowEpisodeEditor({
  open,
  episode,
  team,
  onClose,
}: {
  open: boolean;
  episode: ShowEpisodeRow | null;
  team: TeamMemberOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EditFormValues>({
    resolver: zodResolver(showEpisodeSchema),
    values: {
      id: episode?.id,
      slug: episode?.slug ?? '',
      title: episode?.title ?? '',
      description: episode?.description ?? '',
      youtube_id: episode?.youtube_id ?? '',
      thumbnail_url: episode?.thumbnail_url ?? '',
      duration_seconds: episode?.duration_seconds ?? null,
      published_at: isoToDatetimeLocal(episode?.published_at),
      season: episode?.season ?? 1,
      episode_number: episode?.episode_number ?? null,
      status: episode?.status ?? 'draft',
      display_order: episode?.display_order ?? 0,
      seo_title: episode?.seo_title ?? '',
      seo_description: episode?.seo_description ?? '',
      guests: episode?.guests ?? [],
      mentions: episode?.mentions ?? [],
      chapters: episode?.chapters ?? [],
      host_ids: episode?.host_ids ?? [],
      audio_url: episode?.audio_url ?? '',
      audio_bytes: episode?.audio_bytes ?? 0,
      audio_mime: episode?.audio_mime ?? 'audio/mpeg',
      audio_published_at: isoToDatetimeLocal(episode?.audio_published_at),
      feed_guid: episode?.feed_guid ?? '',
      feed_season: episode?.feed_season ?? null,
      feed_number: episode?.feed_number ?? null,
      explicit: episode?.explicit ?? false,
      episode_type: episode?.episode_type ?? 'full',
      audio_title: episode?.audio_title ?? '',
      audio_description: episode?.audio_description ?? '',
      audio_image_url: episode?.audio_image_url ?? '',
    },
  });

  // Auto-sync slug ← title tant que l'utilisateur n'a pas édité le slug.
  const isNew = !episode;
  const [autoSlug, setAutoSlug] = useState(isNew);
  const lastAutoRef = useRef<string>(episode?.slug ?? '');
  const title = watch('title');
  const slugRegister = register('slug', {
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.value !== lastAutoRef.current) setAutoSlug(false);
    },
  });
  useEffect(() => {
    if (!autoSlug) return;
    const next = slugify(title ?? '');
    lastAutoRef.current = next;
    setValue('slug', next, { shouldValidate: true, shouldDirty: false });
  }, [title, autoSlug, setValue]);
  const onResyncSlug = () => {
    setAutoSlug(true);
    const next = slugify(title ?? '');
    lastAutoRef.current = next;
    setValue('slug', next, { shouldValidate: true });
  };

  const onSubmit = (values: EditFormValues) => {
    setServerError(null);
    startTransition(async () => {
      // Les dates sont saisies à l'heure de Paris : on les convertit ici, dans le navigateur.
      // Le serveur tourne en UTC et lirait « 18:00 » comme 18:00 UTC, soit 20:00 à Paris :
      // chaque enregistrement décalait la date de 1 ou 2 heures.
      const result = await saveShowEpisode({
        ...values,
        published_at: datetimeLocalToIso(values.published_at ?? '') ?? '',
        audio_published_at: datetimeLocalToIso(values.audio_published_at ?? '') ?? '',
      });
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
    if (!episode) return;
    if (!confirm(`Supprimer définitivement « ${episode.title} » ?`)) return;
    startTransition(async () => {
      const result = await deleteShowEpisode(episode.id);
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
      crumbs={episode ? `Édition · ${episode.title}` : 'Nouvel épisode YouTube'}
      title={episode ? episode.title : 'Ajouter un épisode'}
      footer={
        <>
          {episode ? (
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
            form="show-episode-form"
            className={clsx('admin-btn admin-btn-primary', pending && 'opacity-70')}
            disabled={pending}
          >
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <form id="show-episode-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <SectionTitle>Métadonnées</SectionTitle>
        <FormGrid>
          <Field full label="Titre" error={errors.title?.message}>
            <input className="admin-input" {...register('title')} />
          </Field>
          <SlugField
            registerProps={slugRegister}
            onResync={onResyncSlug}
            error={errors.slug?.message}
          />
          <Field label="YouTube ID" hint="Ex: dQw4w9WgXcQ" error={errors.youtube_id?.message}>
            <input className="admin-input font-mono text-[12px]" {...register('youtube_id')} />
          </Field>
          <Field label="Statut" error={errors.status?.message}>
            <select className="admin-select" {...register('status')}>
              <option value="draft">Brouillon</option>
              <option value="published">Publié</option>
            </select>
          </Field>
          <Field label="Saison" error={errors.season?.message}>
            <input
              className="admin-input"
              type="number"
              min={1}
              {...register('season', { valueAsNumber: true })}
            />
          </Field>
          <Field label="Numéro d'épisode" error={errors.episode_number?.message}>
            <input
              className="admin-input"
              type="number"
              min={1}
              placeholder="Optionnel"
              {...register('episode_number', {
                setValueAs: (v) => (v === '' || v == null ? null : Number(v)),
              })}
            />
          </Field>
          <Field label="Date de publication" error={errors.published_at?.message}>
            <input className="admin-input" type="datetime-local" {...register('published_at')} />
          </Field>
          <AudioField
            audioUrl={watch('audio_url') ?? ''}
            audioBytes={watch('audio_bytes') ?? 0}
            audioPublishedAt={watch('audio_published_at') ?? ''}
            episodeType={watch('episode_type') ?? 'full'}
            explicit={watch('explicit') ?? false}
            audioTitle={watch('audio_title') ?? ''}
            audioDescription={watch('audio_description') ?? ''}
            audioImageUrl={watch('audio_image_url') ?? ''}
            durationSeconds={watch('duration_seconds') ?? null}
            onChange={(patch) => {
              for (const [cle, valeur] of Object.entries(patch)) {
                setValue(cle as keyof EditFormValues, valeur as never, { shouldValidate: true });
              }
            }}
            errors={{
              audio_url: errors.audio_url?.message,
              audio_bytes: errors.audio_bytes?.message,
              audio_published_at: errors.audio_published_at?.message,
              audio_title: errors.audio_title?.message,
              audio_description: errors.audio_description?.message,
            }}
          />
          <DurationField
            initial={episode?.duration_seconds ?? null}
            onChange={(s) => setValue('duration_seconds', s, { shouldValidate: true })}
            error={errors.duration_seconds?.message}
          />
          <Field full label="URL miniature (override)" error={errors.thumbnail_url?.message}>
            <input
              className="admin-input"
              placeholder="Vide → la miniature YouTube par défaut sera utilisée"
              {...register('thumbnail_url')}
            />
          </Field>
        </FormGrid>

        <SectionTitle>Description</SectionTitle>
        <FormGrid>
          <Field full label="Description" error={errors.description?.message}>
            <textarea className="admin-textarea" rows={4} {...register('description')} />
          </Field>
        </FormGrid>

        <SectionTitle>Animateurs présents</SectionTitle>
        <FormGrid>
          <HostsField control={control} members={team} error={errors.host_ids?.message} />
        </FormGrid>

        <SectionTitle>Invités</SectionTitle>
        <FormGrid>
          <GuestsField control={control} register={register} />
        </FormGrid>

        <SectionTitle>Œuvres mentionnées</SectionTitle>
        <FormGrid>
          <MentionsField control={control} register={register} />
        </FormGrid>

        <SectionTitle>Chapitres / Timecodes</SectionTitle>
        <FormGrid>
          <ChaptersField control={control} register={register} />
        </FormGrid>

        <SectionTitle>SEO</SectionTitle>
        <FormGrid>
          <Field
            full
            label="Titre SEO"
            hint="Optionnel — sinon le titre sera utilisé."
            error={errors.seo_title?.message}
          >
            <input className="admin-input" {...register('seo_title')} />
          </Field>
          <Field
            full
            label="Description SEO"
            hint="160 caractères max recommandé."
            error={errors.seo_description?.message}
          >
            <textarea className="admin-textarea" rows={2} {...register('seo_description')} />
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mt-6 mb-3 border-b border-admin-border pb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-admin-muted first:mt-0">
      {children}
    </h4>
  );
}

/* Champ durée saisie en mm:ss avec stockage en secondes (sans react-hook-form
   register direct car on convertit). On set la valeur sur blur. */
function DurationField({
  initial,
  onChange,
  error,
}: {
  initial: number | null;
  onChange: (seconds: number | null) => void;
  error?: string;
}) {
  const [value, setValue] = useState(secondsToTimecode(initial));
  return (
    <Field label="Durée (mm:ss)" hint="Optionnel" error={error}>
      <input
        className="admin-input font-mono text-[12px]"
        placeholder="42:18"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={(e) => {
          const seconds = timecodeToSeconds(e.target.value);
          onChange(seconds);
          setValue(secondsToTimecode(seconds));
        }}
      />
    </Field>
  );
}
