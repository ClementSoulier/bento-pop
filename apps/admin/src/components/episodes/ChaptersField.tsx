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
import { secondsToTimecode, timecodeToSeconds } from '@/lib/episodes/format';
import type { EpisodeFormCommon } from '@/lib/episodes/schemas';

type ChaptersFieldProps<T extends FieldValues & EpisodeFormCommon> = {
  control: Control<T>;
  register: UseFormRegister<T>;
};

export function ChaptersField<T extends FieldValues & EpisodeFormCommon>({
  control,
  register,
}: ChaptersFieldProps<T>) {
  const { fields, append, remove } = useFieldArray<T>({
    name: 'chapters' as ArrayPath<T>,
    control,
  });

  return (
    <div className="col-span-2">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
          Chapitres / Timecodes ({fields.length})
        </span>
        <button
          type="button"
          className="admin-btn admin-btn-sm"
          onClick={() =>
            append({ label: '', start_seconds: 0 } as unknown as FieldArray<T, ArrayPath<T>>)
          }
        >
          <PlusIcon />
          Ajouter
        </button>
      </div>
      {fields.length === 0 ? (
        <p className="rounded-admin-input border border-dashed border-admin-border px-3 py-3 text-center text-[12px] text-admin-muted">
          Aucun chapitre.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {fields.map((field, i) => (
            <div key={field.id} className="grid grid-cols-[110px_1fr_auto] gap-2">
              <Controller
                control={control}
                name={`chapters.${i}.start_seconds` as Path<T>}
                render={({ field: tcField, fieldState }) => (
                  <div>
                    <input
                      className="admin-input font-mono text-[12px]"
                      placeholder="mm:ss"
                      defaultValue={secondsToTimecode(tcField.value as unknown as number)}
                      onBlur={(e) => {
                        const seconds = timecodeToSeconds(e.target.value);
                        tcField.onChange(seconds ?? 0);
                        e.target.value = secondsToTimecode(seconds ?? 0);
                      }}
                    />
                    {fieldState.error ? (
                      <span className="mt-1 block text-[10px] text-bento-red">
                        {fieldState.error.message}
                      </span>
                    ) : null}
                  </div>
                )}
              />
              <input
                className="admin-input"
                placeholder="Titre du chapitre"
                {...register(`chapters.${i}.label` as Path<T>)}
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
