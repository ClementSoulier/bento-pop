'use client';

import type { RelatedEpisodeRef } from '@/lib/blog/schemas';

export type EpisodeOption = RelatedEpisodeRef & {
  title: string;
  /** Ex. « S2 · E4 » */
  label: string;
  draft: boolean;
};

type Props = {
  value: RelatedEpisodeRef[];
  onChange: (refs: RelatedEpisodeRef[]) => void;
  options: EpisodeOption[];
  error?: string;
};

const keyOf = (r: RelatedEpisodeRef) => `${r.kind}:${r.id}`;

/**
 * Émissions et podcasts cités par l'article (docs/BLOG.md D7), affichés en cartes en
 * bas de l'article dans l'ordre choisi ici. Un épisode en brouillon peut être lié : il
 * n'apparaîtra sur le site qu'une fois publié.
 */
export function RelatedEpisodesField({ value, onChange, options, error }: Props) {
  const byKey = new Map(options.map((o) => [keyOf(o), o]));
  const chosen = new Set(value.map(keyOf));
  const shows = options.filter((o) => o.kind === 'show' && !chosen.has(keyOf(o)));
  const podcasts = options.filter((o) => o.kind === 'podcast' && !chosen.has(keyOf(o)));

  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length) return;
    const next = value.slice();
    const [item] = next.splice(from, 1);
    if (item) next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <div>
      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
        Épisodes liés
      </span>
      {value.length > 0 ? (
        <ul className="mb-3 space-y-1.5">
          {value.map((ref, i) => {
            const opt = byKey.get(keyOf(ref));
            return (
              <li
                key={keyOf(ref)}
                className="flex items-center gap-2 rounded-admin-input border border-admin-border bg-admin-surface-2 px-2.5 py-1.5 text-[12px]"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-admin-muted">
                  {ref.kind === 'show' ? 'Émission' : 'Podcast'} {opt?.label}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {opt?.title ?? 'Épisode supprimé'}
                  {opt?.draft ? <span className="ml-1 text-admin-muted">(brouillon)</span> : null}
                </span>
                <button
                  type="button"
                  className="px-1 text-admin-muted hover:text-admin-ink disabled:opacity-30"
                  aria-label="Monter"
                  disabled={i === 0}
                  onClick={() => move(i, i - 1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="px-1 text-admin-muted hover:text-admin-ink disabled:opacity-30"
                  aria-label="Descendre"
                  disabled={i === value.length - 1}
                  onClick={() => move(i, i + 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="px-1 text-admin-muted hover:text-bento-red"
                  aria-label={`Retirer ${opt?.title ?? 'cet épisode'}`}
                  onClick={() => onChange(value.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <select
        className="admin-select"
        value=""
        aria-label="Ajouter un épisode lié"
        onChange={(e) => {
          const opt = byKey.get(e.target.value);
          if (opt) onChange([...value, { kind: opt.kind, id: opt.id }]);
        }}
      >
        <option value="">+ Ajouter un épisode…</option>
        {shows.length > 0 ? (
          <optgroup label="Émissions YouTube">
            {shows.map((o) => (
              <option key={keyOf(o)} value={keyOf(o)}>
                {o.label} · {o.title}
                {o.draft ? ' (brouillon)' : ''}
              </option>
            ))}
          </optgroup>
        ) : null}
        {podcasts.length > 0 ? (
          <optgroup label="Podcasts">
            {podcasts.map((o) => (
              <option key={keyOf(o)} value={keyOf(o)}>
                {o.label} · {o.title}
                {o.draft ? ' (brouillon)' : ''}
              </option>
            ))}
          </optgroup>
        ) : null}
      </select>
      {error ? <p className="mt-2 text-[11px] text-bento-red">{error}</p> : null}
    </div>
  );
}
