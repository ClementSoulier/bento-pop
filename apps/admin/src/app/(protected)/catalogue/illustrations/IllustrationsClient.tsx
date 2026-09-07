'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { acceptStoredSuggestion, dismissItemSuggestions } from '../actions';

export type SuggestionCandidate = {
  id: string;
  thumbnailUrl: string;
  attribution: string | null;
  licenseCode: string | null;
  wikipediaPageUrl: string | null;
};

export type SuggestionGroup = {
  itemId: string;
  title: string;
  subtitle: string | null;
  year: number | null;
  categoryLabel: string;
  bentoCount: number;
  candidates: SuggestionCandidate[];
};

/**
 * Revue en lot : une carte par item, ses candidats côte à côte, un clic
 * pour trancher. L'item traité disparaît de la liste sans recharger la page
 * (`done`), pour pouvoir enchaîner sans perdre sa position de scroll.
 */
export function IllustrationsClient({ groups }: { groups: SuggestionGroup[] }) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const remaining = groups.filter((g) => !done.has(g.itemId));

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <div className="rounded-md border-2 border-bento-red bg-bento-red/10 px-4 py-2 text-[13px]">
          {error}
        </div>
      ) : null}

      {remaining.length === 0 ? (
        <div className="admin-card p-6 text-[14px] text-admin-muted">
          File vide. Tout est tranché.
        </div>
      ) : (
        remaining.map((group) => (
          <ItemCard
            key={group.itemId}
            group={group}
            setError={setError}
            onDone={() => setDone((s) => new Set(s).add(group.itemId))}
          />
        ))
      )}
    </div>
  );
}

function ItemCard({
  group,
  setError,
  onDone,
}: {
  group: SuggestionGroup;
  setError: (e: string | null) => void;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();

  const onAccept = (candidateId: string) => {
    startTransition(async () => {
      const res = await acceptStoredSuggestion({ suggestionId: candidateId });
      if (!res.ok) setError(res.error);
      else {
        setError(null);
        onDone();
      }
    });
  };

  const onDismiss = () => {
    startTransition(async () => {
      const res = await dismissItemSuggestions({ itemId: group.itemId });
      if (!res.ok) setError(res.error);
      else {
        setError(null);
        onDone();
      }
    });
  };

  return (
    <div className="admin-card p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-admin-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-admin-muted">
              {group.categoryLabel}
            </span>
            <Link
              href={`/catalogue/${group.itemId}`}
              className="truncate text-[15px] font-bold underline"
            >
              {group.title}
            </Link>
            {group.year ? (
              <span className="text-[13px] text-admin-muted">({group.year})</span>
            ) : null}
          </div>
          {group.subtitle ? (
            <p className="mt-1 line-clamp-1 text-[12px] text-admin-muted">{group.subtitle}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-admin-muted">
            {group.bentoCount} bento{group.bentoCount > 1 ? 's' : ''}
          </span>
          <button
            type="button"
            onClick={onDismiss}
            disabled={pending}
            className="rounded-md border border-admin-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] hover:bg-admin-ink hover:text-bento-cream disabled:opacity-50"
          >
            Aucune
          </button>
        </div>
      </div>

      <ul className="grid grid-cols-3 gap-3">
        {group.candidates.map((c) => (
          <li
            key={c.id}
            className="flex flex-col overflow-hidden rounded-md border border-admin-border bg-white"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- URL Wikimedia
                arbitraire, next/image demanderait un remotePatterns pour un simple
                thumbnail de back-office */}
            <img
              src={c.thumbnailUrl}
              alt={group.title}
              className="aspect-[3/4] w-full bg-admin-bg object-cover"
              loading="lazy"
            />
            <div className="flex flex-1 flex-col gap-1.5 p-2 text-[11px]">
              {c.wikipediaPageUrl ? (
                <a
                  href={c.wikipediaPageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="line-clamp-1 underline"
                >
                  {decodeURIComponent(c.wikipediaPageUrl.split('/wiki/')[1] ?? 'Wikipedia').replace(
                    /_/g,
                    ' ',
                  )}{' '}
                  ↗
                </a>
              ) : null}
              {c.attribution ? (
                <span className="line-clamp-2 text-admin-muted">{c.attribution}</span>
              ) : (
                <span className="italic text-admin-muted">(pas d&apos;attribution)</span>
              )}
              <button
                type="button"
                onClick={() => onAccept(c.id)}
                disabled={pending}
                className="mt-auto rounded-md border-2 border-bento-ink bg-bento-cream px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] hover:-translate-y-0.5 disabled:opacity-50"
              >
                {pending ? '…' : 'Utiliser'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
