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
        <div className="flex flex-col gap-2">
          {fields.map((field, i) => (
            <div key={field.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
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
              <input
                className="admin-input"
                placeholder="URL photo (optionnel)"
                {...register(`guests.${i}.photo_url` as Path<T>)}
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

// Force le bundler à garder le type exporté pour usage externe.
export type { EpisodeGuest };
