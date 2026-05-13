'use client';

import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { clsx } from '@/lib/clsx';
import type { EpisodeFormCommon } from '@/lib/episodes/schemas';

export type TeamMemberOption = {
  id: string;
  name: string;
  nick: string;
};

type HostsFieldProps<T extends FieldValues & EpisodeFormCommon> = {
  control: Control<T>;
  members: TeamMemberOption[];
  error?: string;
};

/**
 * Sélection des animateurs présents sur l'épisode. Vu qu'il n'y a que ~4
 * membres dans landing_team, on affiche des chips cliquables plutôt qu'un
 * multi-select. L'ordre du tableau pilote display_order côté DB.
 */
export function HostsField<T extends FieldValues & EpisodeFormCommon>({
  control,
  members,
  error,
}: HostsFieldProps<T>) {
  return (
    <div className="col-span-2">
      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
        Animateurs
      </span>
      <Controller
        control={control}
        name={'host_ids' as Path<T>}
        render={({ field }) => {
          const value = (field.value as unknown as string[]) ?? [];
          const selected = new Set(value);
          const toggle = (id: string) => {
            if (selected.has(id)) {
              field.onChange(value.filter((x) => x !== id));
            } else {
              field.onChange([...value, id]);
            }
          };
          return (
            <div className="flex flex-wrap gap-2">
              {members.length === 0 ? (
                <span className="text-[12px] text-admin-muted">
                  Aucun membre dans l’équipe — ajoute-les dans la section Team.
                </span>
              ) : (
                members.map((m) => {
                  const active = selected.has(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggle(m.id)}
                      className={clsx(
                        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors',
                        active
                          ? 'border-admin-ink bg-admin-ink text-bento-cream'
                          : 'border-admin-border bg-admin-surface-2 text-admin-ink-2 hover:border-admin-ink hover:text-admin-ink',
                      )}
                    >
                      <span>{m.name}</span>
                      <span
                        className={clsx(
                          'font-mono text-[10px] uppercase tracking-[0.1em]',
                          active ? 'text-bento-yellow' : 'text-admin-muted',
                        )}
                      >
                        {m.nick}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          );
        }}
      />
      {error ? <p className="mt-2 text-[11px] text-bento-red">{error}</p> : null}
    </div>
  );
}
