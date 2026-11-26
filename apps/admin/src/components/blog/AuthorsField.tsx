'use client';

import type { TeamMemberOption } from '@/components/episodes/HostsField';
import { clsx } from '@/lib/clsx';

type Props = {
  value: string[];
  onChange: (ids: string[]) => void;
  members: TeamMemberOption[];
  error?: string;
};

/**
 * Auteurs de l'article, pris dans la Team (docs/BLOG.md D5). L'ordre des clics donne
 * l'ordre de la signature, comme pour les animateurs des épisodes.
 */
export function AuthorsField({ value, onChange, members, error }: Props) {
  const selected = new Set(value);
  const toggle = (id: string) =>
    onChange(selected.has(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <div>
      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
        Auteurs
      </span>
      <div className="flex flex-wrap gap-2">
        {members.length === 0 ? (
          <span className="text-[12px] text-admin-muted">
            Aucun membre dans l’équipe : ajoute-les dans la section Team.
          </span>
        ) : (
          members.map((m) => {
            const active = selected.has(m.id);
            const rank = value.indexOf(m.id);
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(m.id)}
                className={clsx(
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors',
                  active
                    ? 'border-admin-ink bg-admin-ink text-bento-cream'
                    : 'border-admin-border bg-admin-surface-2 text-admin-ink-2 hover:border-admin-ink hover:text-admin-ink',
                )}
              >
                {active && value.length > 1 ? (
                  <span className="font-mono text-[10px] text-bento-yellow">{rank + 1}</span>
                ) : null}
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
      {error ? <p className="mt-2 text-[11px] text-bento-red">{error}</p> : null}
    </div>
  );
}
