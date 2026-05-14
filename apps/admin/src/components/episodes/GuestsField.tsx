'use client';

import {
  Controller,
  useFieldArray,
  type ArrayPath,
  type Control,
  type FieldArray,
  type FieldValues,
  type Path,
  type UseFormRegister,
} from 'react-hook-form';
import { PlusIcon, TrashIcon } from '@/components/icons';
import { PhotoUploader } from '@/components/PhotoUploader';
import type { EpisodeFormCommon, EpisodeGuest } from '@/lib/episodes/schemas';

type GuestsFieldProps<T extends FieldValues & EpisodeFormCommon> = {
  control: Control<T>;
  register: UseFormRegister<T>;
};

export function GuestsField<T extends FieldValues & EpisodeFormCommon>({
  control,
  register,
}: GuestsFieldProps<T>) {
  const { fields, append, remove } = useFieldArray<T>({
    name: 'guests' as ArrayPath<T>,
    control,
  });

  return (
    <div className="col-span-2">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
          Invités ({fields.length})
        </span>
        <button
          type="button"
          className="admin-btn admin-btn-sm"
          onClick={() =>
            append({ name: '', role: '', photo_url: '' } as unknown as FieldArray<T, ArrayPath<T>>)
          }
        >
          <PlusIcon />
          Ajouter
        </button>
      </div>
      {fields.length === 0 ? (
        <p className="rounded-admin-input border border-dashed border-admin-border px-3 py-3 text-center text-[12px] text-admin-muted">
          Aucun invité.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {fields.map((field, i) => (
            <div
              key={field.id}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-admin-input border border-admin-border bg-admin-surface-2 p-2"
            >
              <Controller
                control={control}
                name={`guests.${i}.photo_url` as Path<T>}
                render={({ field: photoField }) => (
                  <PhotoUploader
                    currentUrl={(photoField.value as string) || null}
                    bucket="episode-media"
                    pathPrefix="guests/"
                    outputFormat="webp"
                    targetSize={600}
                    modalLabel="Photo invité · cropping carré"
                    size="sm"
                    onUploaded={(url) => photoField.onChange(url)}
                  />
                )}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="admin-input"
                  placeholder="Nom"
                  {...register(`guests.${i}.name` as Path<T>)}
                />
                <input
                  className="admin-input"
                  placeholder="Rôle (ex: streamer)"
                  {...register(`guests.${i}.role` as Path<T>)}
                />
              </div>
              <button
                type="button"
                className="admin-btn admin-btn-sm admin-btn-ghost"
                title="Retirer"
                onClick={() => remove(i)}
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Force le bundler à garder le type exporté pour usage externe.
export type { EpisodeGuest };
