'use client';

import {
  useFieldArray,
  type ArrayPath,
  type Control,
  type FieldArray,
  type FieldValues,
  type Path,
  type UseFormRegister,
} from 'react-hook-form';
import { PlusIcon, TrashIcon } from '@/components/icons';
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
        <div className="flex flex-col gap-2">
          {fields.map((field, i) => (
            <div
              key={field.id}
              className="grid grid-cols-[120px_1fr_1fr_1fr_auto] gap-2"
            >
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
                placeholder="URL (optionnel)"
                {...register(`mentions.${i}.url` as Path<T>)}
              />
              <input
                className="admin-input"
                placeholder="URL cover (optionnel)"
                {...register(`mentions.${i}.cover_url` as Path<T>)}
              />
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
