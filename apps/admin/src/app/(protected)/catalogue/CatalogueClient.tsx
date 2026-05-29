'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  acceptImageSuggestion,
  getSimilarsForItem,
  mergeItems,
  rejectItem,
  searchAnyItems,
  suggestImageForItem,
  validateItem,
  type AnyItemMatch,
  type SimilarCandidate,
  type WikiImageCandidate,
} from './actions';
import { createDraftItem } from './[id]/actions';

export type CatalogueItemRow = {
  id: string;
  title: string;
  categoryLabel: string;
  categoryKey: string | null;
  submittedAt: string | null;
  authorPseudo: string | null;
  status: 'pending' | 'validated' | 'rejected';
  rejectedReason?: string | null;
};

export type ItemStatus = 'draft' | 'pending' | 'validated' | 'rejected' | 'merged';

/** Ligne du tableau « tout le catalogue » (vue d'ensemble filtrable). */
export type CatalogueFullRow = {
  id: string;
  title: string;
  subtitle: string | null;
  year: number | null;
  hasImage: boolean;
  categoryLabel: string;
  categoryKey: string | null;
  status: ItemStatus;
};

type Props = { pending: CatalogueItemRow[]; allItems: CatalogueFullRow[] };

export function CatalogueClient({ pending, allItems }: Props) {
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <Toolbar setError={setError} />

      {error ? (
        <div className="admin-card border-bento-red bg-bento-red/10 px-4 py-3 text-[13px] text-bento-red">
          {error}
        </div>
      ) : null}

      <Section
        title={`À modérer (${pending.length})`}
        empty="Aucune proposition en attente. ✨"
      >
        {pending.map((item) => (
          <PendingRow key={item.id} item={item} setError={setError} />
        ))}
      </Section>

      <CatalogueTable items={allItems} />
    </div>
  );
}

/* ─── Toolbar : recherche cross-status + bouton Nouvel item ─────────── */

const CATEGORY_OPTIONS: { key: 'film' | 'series' | 'artist' | 'track' | 'creator' | 'place'; label: string }[] = [
  { key: 'film', label: 'Film' },
  { key: 'series', label: 'Série' },
  { key: 'artist', label: 'Artiste' },
  { key: 'track', label: 'Chanson' },
  { key: 'creator', label: 'Créateur' },
  { key: 'place', label: 'Lieu' },
];

function Toolbar({ setError }: { setError: (e: string | null) => void }) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<AnyItemMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onQueryChange = (q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (q.trim().length < 2) {
        setMatches([]);
        return;
      }
      setSearching(true);
      const res = await searchAnyItems({ q });
      setSearching(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMatches(res.matches);
    }, 250);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <input
            className="admin-input w-full"
            placeholder="Chercher dans le catalogue (titre…)"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
          {matches.length > 0 ? (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-72 overflow-auto rounded-md border border-admin-border bg-admin-surface shadow-lg">
              <ul className="flex flex-col divide-y divide-admin-border">
                {matches.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/catalogue/${m.id}`}
                      className="flex items-center gap-3 px-3 py-2 text-[12px] hover:bg-admin-bg"
                      onClick={() => {
                        setMatches([]);
                        setQuery('');
                      }}
                    >
                      <span className="rounded border border-admin-border bg-admin-bg px-1.5 py-px font-mono text-[9px] uppercase tracking-[0.12em] text-admin-muted">
                        {m.status}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-admin-muted">
                        {m.categoryLabel}
                      </span>
                      <span className="flex-1 truncate font-semibold">{m.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {searching ? (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] uppercase tracking-[0.12em] text-admin-muted">
              …
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setShowNew((s) => !s)}
          className="admin-btn admin-btn-primary whitespace-nowrap"
        >
          {showNew ? 'Annuler' : '+ Nouvel item'}
        </button>
      </div>
      {showNew ? <NewDraftForm setError={setError} onDone={() => setShowNew(false)} /> : null}
    </div>
  );
}

function NewDraftForm({
  setError,
  onDone,
}: {
  setError: (e: string | null) => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState('');
  const [categoryKey, setCategoryKey] = useState<typeof CATEGORY_OPTIONS[number]['key']>('film');

  const onSubmit = () => {
    if (title.trim().length < 1) return;
    setError(null);
    startTransition(async () => {
      try {
        await createDraftItem({ categoryKey, title: title.trim() });
        // createDraftItem redirige côté serveur, mais au cas où on revient
        // ici on force un refresh.
        router.refresh();
        onDone();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  return (
    <div className="admin-card flex items-center gap-3 px-4 py-3">
      <select
        className="admin-input w-[140px]"
        value={categoryKey}
        onChange={(e) => setCategoryKey(e.target.value as typeof categoryKey)}
      >
        {CATEGORY_OPTIONS.map((c) => (
          <option key={c.key} value={c.key}>
            {c.label}
          </option>
        ))}
      </select>
      <input
        className="admin-input flex-1"
        placeholder="Titre de l'item…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit();
        }}
        maxLength={200}
        autoFocus
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={pending || title.trim().length === 0}
        className="admin-btn admin-btn-primary"
      >
        {pending ? 'Création…' : 'Créer brouillon'}
      </button>
    </div>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children) && children.length > 0;
  return (
    <section className="admin-card overflow-hidden">
      <header className="border-b border-admin-border bg-admin-bg/60 px-4 py-3 text-[13px] font-semibold">
        {title}
      </header>
      {hasChildren ? (
        <div className="flex flex-col divide-y divide-admin-border">{children}</div>
      ) : (
        <div className="px-4 py-6 text-center text-[12px] text-admin-muted">{empty}</div>
      )}
    </section>
  );
}

function PendingRow({
  item,
  setError,
}: {
  item: CatalogueItemRow;
  setError: (e: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [showMerge, setShowMerge] = useState(false);
  const [candidates, setCandidates] = useState<SimilarCandidate[] | null>(null);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [showImages, setShowImages] = useState(false);
  const [imageCandidates, setImageCandidates] = useState<WikiImageCandidate[] | null>(null);
  const [loadingImages, setLoadingImages] = useState(false);

  const onValidate = () => {
    startTransition(async () => {
      const res = await validateItem({ itemId: item.id });
      if (!res.ok) setError(res.error);
      else setError(null);
    });
  };

  const onReject = () => {
    const reason = window.prompt(
      `Refuser « ${item.title} » ?\n\nMotif (optionnel, pour traçabilité interne) :`,
      '',
    );
    if (reason === null) return;
    startTransition(async () => {
      const res = await rejectItem({
        itemId: item.id,
        reason: reason.trim() || undefined,
      });
      if (!res.ok) setError(res.error);
      else setError(null);
    });
  };

  const onToggleMerge = async () => {
    const next = !showMerge;
    setShowMerge(next);
    if (next && candidates === null) {
      setLoadingCandidates(true);
      const res = await getSimilarsForItem({ itemId: item.id });
      setLoadingCandidates(false);
      if (!res.ok) {
        setError(res.error);
        setCandidates([]);
        return;
      }
      setCandidates(res.candidates);
    }
  };

  const onMergeInto = (canonical: SimilarCandidate) => {
    if (
      !confirm(
        `Fusionner « ${item.title} » dans « ${canonical.title}${
          canonical.year ? ` (${canonical.year})` : ''
        } » ?\n\nLes bento_items qui pointent vers la proposition seront réécrits vers le canonique, et le titre soumis deviendra un alias.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await mergeItems({
        canonicalId: canonical.id,
        loserIds: [item.id],
      });
      if (!res.ok) setError(res.error);
      else setError(null);
    });
  };

  const onToggleImages = async () => {
    const next = !showImages;
    setShowImages(next);
    if (next && imageCandidates === null) {
      setLoadingImages(true);
      const res = await suggestImageForItem({ itemId: item.id });
      setLoadingImages(false);
      if (!res.ok) {
        setError(res.error);
        setImageCandidates([]);
        return;
      }
      setImageCandidates(res.candidates);
    }
  };

  const onAcceptImage = (candidate: WikiImageCandidate) => {
    startTransition(async () => {
      const res = await acceptImageSuggestion({
        itemId: item.id,
        sourceUrl: candidate.sourceUrl,
        attribution: candidate.attribution,
        licenseCode: candidate.licenseCode,
      });
      if (!res.ok) setError(res.error);
      else setError(null);
    });
  };

  return (
    <div className="flex flex-col px-4 py-3.5">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-admin-muted">
              {item.categoryLabel}
            </span>
            <Link
              href={`/catalogue/${item.id}`}
              className="text-[14px] font-semibold underline-offset-2 hover:underline"
            >
              {item.title}
            </Link>
          </div>
          <div className="mt-1 font-mono text-[10px] text-admin-muted">
            {item.submittedAt
              ? new Date(item.submittedAt).toLocaleString('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '—'}
            {item.authorPseudo ? (
              <>
                {' · '}
                par <span className="text-admin-ink">@{item.authorPseudo}</span>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onToggleImages}
            disabled={pending}
            className="rounded-md border border-admin-border bg-admin-bg px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] hover:bg-admin-ink hover:text-bento-cream disabled:opacity-50"
          >
            {showImages ? 'Fermer' : 'Image'}
          </button>
          <button
            type="button"
            onClick={onToggleMerge}
            disabled={pending}
            className="rounded-md border border-admin-border bg-admin-bg px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] hover:bg-admin-ink hover:text-bento-cream disabled:opacity-50"
          >
            {showMerge ? 'Annuler' : 'Fusionner'}
          </button>
          <button
            type="button"
            onClick={onReject}
            disabled={pending}
            className="rounded-md border border-admin-border bg-admin-bg px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] hover:bg-admin-ink hover:text-bento-cream disabled:opacity-50"
          >
            Refuser
          </button>
          <button
            type="button"
            onClick={onValidate}
            disabled={pending}
            className="rounded-md border-2 border-bento-ink bg-bento-yellow px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-bento-ink hover:-translate-y-0.5 disabled:opacity-50"
          >
            Valider
          </button>
        </div>
      </div>

      {showImages ? (
        <div className="mt-3 rounded-md border border-admin-border bg-admin-bg/40 px-3 py-2.5">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-admin-muted">
            Illustration depuis Wikipedia
          </div>
          {loadingImages ? (
            <div className="py-3 text-center text-[12px] text-admin-muted">
              Recherche Wikipedia (FR puis EN)…
            </div>
          ) : imageCandidates && imageCandidates.length > 0 ? (
            <ul className="grid grid-cols-3 gap-3">
              {imageCandidates.map((c) => (
                <li
                  key={c.sourceUrl}
                  className="flex flex-col overflow-hidden rounded-md border border-admin-border bg-white"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- on récupère
                      une URL Wikimedia arbitraire, next/image ne sait pas l'optimiser
                      sans config remotePatterns, et c'est juste un thumbnail admin */}
                  <img
                    src={c.thumbnailUrl}
                    alt={c.pageTitle}
                    className="aspect-[3/4] w-full object-cover"
                    loading="lazy"
                  />
                  <div className="flex flex-col gap-1.5 p-2 text-[11px]">
                    <a
                      href={c.wikipediaPageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="line-clamp-1 underline"
                      title={c.pageTitle}
                    >
                      {c.pageTitle} ↗
                    </a>
                    {c.attribution ? (
                      <span className="line-clamp-2 text-admin-muted">
                        {c.attribution}
                      </span>
                    ) : (
                      <span className="italic text-admin-muted">
                        (pas d&apos;attribution disponible)
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onAcceptImage(c)}
                      disabled={pending}
                      className="mt-1 rounded-md border-2 border-bento-ink bg-bento-cream px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] hover:-translate-y-0.5 disabled:opacity-50"
                    >
                      Utiliser
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-2 text-[12px] text-admin-muted">
              Aucune illustration trouvée. Tu peux uploader manuellement via
              la fiche item (à venir) ou valider sans image.
            </div>
          )}
        </div>
      ) : null}

      {showMerge ? (
        <div className="mt-3 rounded-md border border-admin-border bg-admin-bg/40 px-3 py-2.5">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-admin-muted">
            Fusionner avec un item validé
          </div>
          {loadingCandidates ? (
            <div className="py-3 text-center text-[12px] text-admin-muted">
              Recherche des similaires…
            </div>
          ) : candidates && candidates.length > 0 ? (
            <ul className="flex flex-col divide-y divide-admin-border">
              {candidates.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-[13px] font-semibold">
                      {c.title}
                      {c.year ? (
                        <span className="ml-1 font-normal text-admin-muted">
                          ({c.year})
                        </span>
                      ) : null}
                    </div>
                    {c.subtitle ? (
                      <div className="truncate text-[11px] text-admin-muted">
                        {c.subtitle}
                      </div>
                    ) : null}
                    <div className="font-mono text-[10px] text-admin-muted">
                      score {Math.round(c.score * 100)}%
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onMergeInto(c)}
                    disabled={pending}
                    className="rounded-md border-2 border-bento-ink bg-bento-cream px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] hover:-translate-y-0.5 disabled:opacity-50"
                  >
                    Fusionner ici
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-2 text-[12px] text-admin-muted">
              Aucun item validé similaire trouvé. Valide pour créer un nouveau
              canonique, ou refuse si la proposition n&apos;est pas pertinente.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

/* ─── Tableau « tout le catalogue » ────────────────────────────────────
   Vue d'ensemble de TOUS les items, quel que soit leur statut (y compris
   les validés historiques sans `validated_at`). Filtres : type (catégorie)
   + statut, plus une recherche locale sur titre/sous-titre. */

const STATUS_META: Record<ItemStatus, { label: string; cls: string }> = {
  validated: { label: 'validé', cls: 'bg-bento-yellow text-bento-ink' },
  pending: { label: 'en attente', cls: 'bg-bento-red/15 text-bento-red' },
  draft: { label: 'brouillon', cls: 'bg-admin-bg text-admin-muted' },
  rejected: { label: 'rejeté', cls: 'bg-admin-bg text-admin-muted line-through' },
  merged: { label: 'fusionné', cls: 'bg-admin-bg text-admin-muted' },
};

const STATUS_FILTERS: { key: ItemStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Tous statuts' },
  { key: 'validated', label: 'Validés' },
  { key: 'pending', label: 'En attente' },
  { key: 'draft', label: 'Brouillons' },
  { key: 'rejected', label: 'Rejetés' },
  { key: 'merged', label: 'Fusionnés' },
];

function ImageIcon({ present }: { present: boolean }) {
  // Petit pictogramme « image » : plein/jaune si l'item a une illustration,
  // contour gris barré sinon. Permet de repérer d'un coup d'œil les items
  // sans visuel à compléter.
  return (
    <span title={present ? 'Image présente' : 'Pas d’image'} aria-label={present ? 'Image présente' : 'Pas d’image'}>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke={present ? '#0a0a0a' : 'currentColor'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={present ? 'text-bento-ink' : 'text-admin-muted opacity-50'}
      >
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" fill={present ? '#fbbf24' : 'none'} />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
    </span>
  );
}

function CatalogueTable({ items }: { items: CatalogueFullRow[] }) {
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<ItemStatus | 'all'>('all');
  const [q, setQ] = useState('');

  const query = q.trim().toLowerCase();
  const filtered = items.filter((it) => {
    if (typeFilter !== 'all' && it.categoryKey !== typeFilter) return false;
    if (statusFilter !== 'all' && it.status !== statusFilter) return false;
    if (
      query &&
      !it.title.toLowerCase().includes(query) &&
      !(it.subtitle ?? '').toLowerCase().includes(query)
    ) {
      return false;
    }
    return true;
  });

  return (
    <section className="admin-card overflow-hidden">
      <header className="flex flex-col gap-3 border-b border-admin-border bg-admin-bg/60 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-semibold">
            Tout le catalogue ({filtered.length}
            {filtered.length !== items.length ? ` / ${items.length}` : ''})
          </span>
          <input
            className="admin-input w-[200px] text-[12px]"
            placeholder="Filtrer (titre, sous-titre…)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip active={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>
            Tous types
          </FilterChip>
          {CATEGORY_OPTIONS.map((c) => (
            <FilterChip
              key={c.key}
              active={typeFilter === c.key}
              onClick={() => setTypeFilter(c.key)}
            >
              {c.label}
            </FilterChip>
          ))}
          <span className="mx-1 h-4 w-px bg-admin-border" />
          <select
            className="admin-input h-[28px] w-[150px] py-0 text-[11px]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ItemStatus | 'all')}
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      {filtered.length === 0 ? (
        <div className="px-4 py-6 text-center text-[12px] text-admin-muted">
          Aucun item pour ces filtres.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-admin-border text-left font-mono text-[9px] uppercase tracking-[0.15em] text-admin-muted">
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-2 py-2 font-medium">Titre</th>
                <th className="px-2 py-2 font-medium">Sous-titre</th>
                <th className="px-2 py-2 font-medium">Date</th>
                <th className="px-2 py-2 text-center font-medium">Img</th>
                <th className="px-4 py-2 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {filtered.map((it) => {
                const meta = STATUS_META[it.status];
                return (
                  <tr key={it.id} className="hover:bg-admin-bg/50">
                    <td className="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-admin-muted">
                      {it.categoryLabel}
                    </td>
                    <td className="max-w-[260px] px-2 py-2">
                      <Link
                        href={`/catalogue/${it.id}`}
                        className="block truncate font-semibold underline-offset-2 hover:underline"
                        title={it.title}
                      >
                        {it.title}
                      </Link>
                    </td>
                    <td className="max-w-[200px] truncate px-2 py-2 text-admin-muted" title={it.subtitle ?? ''}>
                      {it.subtitle ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 font-mono text-[11px] text-admin-muted">
                      {it.year ?? '—'}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex justify-center">
                        <ImageIcon present={it.hasImage} />
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-block rounded-full border-2 border-bento-ink px-2 py-px font-mono text-[9px] uppercase tracking-[0.12em] ${meta.cls}`}
                      >
                        {meta.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition ${
        active
          ? 'border-bento-ink bg-bento-ink text-bento-cream'
          : 'border-admin-border bg-admin-bg text-admin-muted hover:border-bento-ink hover:text-bento-ink'
      }`}
    >
      {children}
    </button>
  );
}
