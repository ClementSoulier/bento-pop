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
import { MENTION_TYPE_LABELS, type EpisodeFormCommon } from '@/lib/episodes/schemas';

type MentionsFieldProps<T extends FieldValues & EpisodeFormCommon> = {
  control: Control<T>;
  register: UseFormRegister<T>;
};

export function MentionsField<T extends FieldValues & EpisodeFormCommon>({
  control,
  register,
}: MentionsFieldProps<T>) {
  const { fields, append, remove } = useFieldArray<T>({
    name: 'mentions' as ArrayPath<T>,
    control,
  });

  return (
    <div className="col-span-2">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
          Œuvres mentionnées ({fields.length})
        </span>
        <button
          type="button"
          className="admin-btn admin-btn-sm"
          onClick={() =>
            append({
              type: 'game',
              title: '',
              url: '',
              cover_url: '',
            } as unknown as FieldArray<T, ArrayPath<T>>)
          }
        >
          <PlusIcon />
          Ajouter
        </button>
      </div>
      {fields.length === 0 ? (
        <p className="rounded-admin-input border border-dashed border-admin-border px-3 py-3 text-center text-[12px] text-admin-muted">
          Aucune mention.
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
                name={`mentions.${i}.cover_url` as Path<T>}
                render={({ field: coverField }) => (
                  <PhotoUploader
                    currentUrl={(coverField.value as string) || null}
                    bucket="episode-media"
                    pathPrefix="mentions/"
                    outputFormat="webp"
                    targetSize={600}
                    modalLabel="Cover œuvre · cropping carré"
                    size="sm"
                    onUploaded={(url) => coverField.onChange(url)}
                  />
                )}
              />
              <div className="grid grid-cols-[120px_1fr_1fr] gap-2">
                <select
                  className="admin-select"
                  {...register(`mentions.${i}.type` as Path<T>)}
                >
                  {Object.entries(MENTION_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  className="admin-input"
                  placeholder="Titre"
                  {...register(`mentions.${i}.title` as Path<T>)}
                />
                <input
                  className="admin-input"
                  placeholder="URL externe (optionnel)"
                  {...register(`mentions.${i}.url` as Path<T>)}
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
