'use client';

import { Fragment, useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  acceptImageSuggestion,
  getSimilarsForItem,
  mergeItems,
  rejectItem,
  searchAnyItems,
  suggestImageForItem,
  validateDraftsAction,
  validateItem,
  type AnyItemMatch,
  type SimilarCandidate,
  type WikiImageCandidate,
} from './actions';
import { createDraftItem } from './[id]/actions';
import { STATUS_LABELS } from '@/lib/catalogue-types';

export type CatalogueItemRow = {
  id: string;
  title: string;
  typeLabel: string;
  typeKey: string | null;
  submittedAt: string | null;
  /** `null` sans auteur ; `pseudo` à `null` pour un compte qui n'a pas encore de profil. */
  author: { pseudo: string | null } | null;
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
  typeLabel: string;
  typeKey: string | null;
  status: ItemStatus;
  bentoCount: number;
};

/** Un type proposé aux filtres et à la création, actif ou non. */
export type TypeOption = { id: number; key: string; label: string; active: boolean };

/** Un groupe de doublons probables ; le premier item est le canonique proposé. */
export type DuplicateGroupView = {
  typeLabel: string;
  items: { id: string; title: string; status: ItemStatus; bentoCount: number; hasImage: boolean }[];
};

type Props = {
  pending: CatalogueItemRow[];
  allItems: CatalogueFullRow[];
  types: TypeOption[];
  duplicates: DuplicateGroupView[];
  /** Filtres d'ouverture du tableau, lus dans l'URL (`?type=book&statut=draft`). */
  initialTypeFilter: string;
  initialStatusFilter: ItemStatus | 'all';
};

export function CatalogueClient({
  pending,
  allItems,
  types,
  duplicates,
  initialTypeFilter,
  initialStatusFilter,
}: Props) {
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <Toolbar types={types} setError={setError} />

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

      {duplicates.length > 0 ? <DuplicatesSection groups={duplicates} setError={setError} /> : null}

      <CatalogueTable
        items={allItems}
        types={types}
        setError={setError}
        initialTypeFilter={initialTypeFilter}
        initialStatusFilter={initialStatusFilter}
      />
    </div>
  );
}

/* ─── Toolbar : recherche cross-status + bouton Nouvel item ─────────── */

/** Libellé d'un type dans une liste : les inactifs sont signalés. */
function typeOptionLabel(t: TypeOption): string {
  return t.active ? t.label : `${t.label} (inactif)`;
}

function Toolbar({ types, setError }: { types: TypeOption[]; setError: (e: string | null) => void }) {
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
                        {STATUS_META[m.status].label}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-admin-muted">
                        {m.typeLabel}
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
        <Link href="/catalogue/types" className="admin-btn whitespace-nowrap">
          Types
        </Link>
        <button
          type="button"
          onClick={() => setShowNew((s) => !s)}
          className="admin-btn admin-btn-primary whitespace-nowrap"
        >
          {showNew ? 'Annuler' : '+ Nouvel item'}
        </button>
      </div>
      {showNew ? <NewDraftForm types={types} setError={setError} onDone={() => setShowNew(false)} /> : null}
    </div>
  );
}

function NewDraftForm({
  types,
  setError,
  onDone,
}: {
  types: TypeOption[];
  setError: (e: string | null) => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState('');
  const [typeKey, setTypeKey] = useState<string>(types.find((t) => t.active)?.key ?? types[0]?.key ?? '');

  const onSubmit = () => {
    if (title.trim().length < 1 || typeKey === '') return;
    setError(null);
    startTransition(async () => {
      try {
        await createDraftItem({ typeKey, title: title.trim() });
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
        className="admin-input w-[180px]"
        value={typeKey}
        onChange={(e) => setTypeKey(e.target.value)}
      >
        {types.map((t) => (
          <option key={t.key} value={t.key}>
            {typeOptionLabel(t)}
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

  const onValidate = () => {
    startTransition(async () => {
      const res = await validateItem({ itemId: item.id });
      if (!res.ok) setError(res.error);
      else setError(null);
    });
  };

  const onReject = () => {
    const reason = window.prompt(
      `Refuser « ${item.title} » ?\n\nMotif (optionnel) : l'auteur le recevra dans sa notification.`,
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

  return (
    <div className="flex flex-col px-4 py-3.5">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-admin-muted">
              {item.typeLabel}
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
            {item.author ? (
              <>
                {' · '}
                par{' '}
                {item.author.pseudo ? (
                  <span className="text-admin-ink">@{item.author.pseudo}</span>
                ) : (
                  'un compte sans pseudo'
                )}
              </>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setShowImages((s) => !s)}
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
        <div className="mt-3">
          <ImageSuggestionPanel itemId={item.id} setError={setError} />
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
  validated: { label: STATUS_LABELS.validated, cls: 'bg-bento-yellow text-bento-ink' },
  pending: { label: STATUS_LABELS.pending, cls: 'bg-bento-red/15 text-bento-red' },
  draft: { label: STATUS_LABELS.draft, cls: 'bg-admin-bg text-admin-muted' },
  rejected: { label: STATUS_LABELS.rejected, cls: 'bg-admin-bg text-admin-muted line-through' },
  merged: { label: STATUS_LABELS.merged, cls: 'bg-admin-bg text-admin-muted' },
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

/**
 * Panneau de matching d'illustration Wikipedia, réutilisable sur n'importe
 * quel item (file de modération ET tableau complet). Lance la recherche au
 * montage et expose un bouton « Relancer » pour relancer le matching à la
 * demande (ex. après avoir corrigé le titre de l'item).
 */
function ImageSuggestionPanel({
  itemId,
  setError,
}: {
  itemId: string;
  setError: (e: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [candidates, setCandidates] = useState<WikiImageCandidate[] | null>(null);
  const [loading, setLoading] = useState(false);

  const runSearch = useCallback(() => {
    setLoading(true);
    suggestImageForItem({ itemId }).then((res) => {
      setLoading(false);
      if (!res.ok) {
        setError(res.error);
        setCandidates([]);
        return;
      }
      setError(null);
      setCandidates(res.candidates);
    });
  }, [itemId, setError]);

  useEffect(() => {
    runSearch();
  }, [runSearch]);

  const onAccept = (candidate: WikiImageCandidate) => {
    startTransition(async () => {
      const res = await acceptImageSuggestion({
        itemId,
        sourceUrl: candidate.sourceUrl,
        attribution: candidate.attribution,
        licenseCode: candidate.licenseCode,
      });
      if (!res.ok) setError(res.error);
      else setError(null);
    });
  };

  return (
    <div className="rounded-md border border-admin-border bg-admin-bg/40 px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-admin-muted">
          Illustration depuis Wikipedia
        </span>
        <button
          type="button"
          onClick={runSearch}
          disabled={loading || pending}
          className="rounded-md border border-admin-border bg-admin-bg px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] hover:bg-admin-ink hover:text-bento-cream disabled:opacity-50"
        >
          {loading ? 'Recherche…' : '↻ Relancer'}
        </button>
      </div>
      {loading ? (
        <div className="py-3 text-center text-[12px] text-admin-muted">
          Recherche Wikipedia (FR puis EN)…
        </div>
      ) : candidates && candidates.length > 0 ? (
        <ul className="grid grid-cols-3 gap-3">
          {candidates.map((c) => (
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
                {c.description ? (
                  <span className="line-clamp-2 text-admin-muted">{c.description}</span>
                ) : null}
                {c.attribution ? (
                  <span className="line-clamp-2 text-admin-muted">{c.attribution}</span>
                ) : (
                  <span className="italic text-admin-muted">
                    (pas d&apos;attribution disponible)
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onAccept(c)}
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
          Aucune illustration trouvée. Tu peux uploader manuellement via la fiche
          item ou laisser sans image.
        </div>
      )}
    </div>
  );
}

type SortKey = 'type' | 'title' | 'subtitle' | 'date' | 'img' | 'status' | 'bentos';
type SortState = { key: SortKey; dir: 'asc' | 'desc' };

function sortValue(it: CatalogueFullRow, key: SortKey): string | number {
  switch (key) {
    case 'type':
      return it.typeLabel.toLowerCase();
    case 'title':
      return it.title.toLowerCase();
    case 'subtitle':
      return (it.subtitle ?? '').toLowerCase();
    case 'date':
      return it.year ?? 0;
    case 'img':
      return it.hasImage ? 1 : 0;
    case 'status':
      return it.status;
    case 'bentos':
      return it.bentoCount;
  }
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  sort: SortState;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = sort.key === sortKey;
  return (
    <th className={`px-2 py-2 font-medium ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 uppercase tracking-[0.15em] hover:text-bento-ink"
      >
        {label}
        <span className={active ? 'text-bento-ink' : 'opacity-30'}>
          {active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  );
}

function CatalogueTable({
  items,
  types,
  setError,
  initialTypeFilter,
  initialStatusFilter,
}: {
  items: CatalogueFullRow[];
  types: TypeOption[];
  setError: (e: string | null) => void;
  initialTypeFilter: string;
  initialStatusFilter: ItemStatus | 'all';
}) {
  const router = useRouter();
  const [validating, startValidating] = useTransition();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<string>(initialTypeFilter);
  const [statusFilter, setStatusFilter] = useState<ItemStatus | 'all'>(initialStatusFilter);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortState>({ key: 'title', dir: 'asc' });
  const [openImageId, setOpenImageId] = useState<string | null>(null);

  const onSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  const query = q.trim().toLowerCase();
  const filtered = items.filter((it) => {
    if (typeFilter !== 'all' && it.typeKey !== typeFilter) return false;
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

  const sorted = [...filtered].sort((a, b) => {
    const va = sortValue(a, sort.key);
    const vb = sortValue(b, sort.key);
    const r =
      typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb), 'fr');
    return sort.dir === 'asc' ? r : -r;
  });

  // Seuls les brouillons se valident par lot : on ne garde de la sélection
  // que ce qui est encore visible et encore brouillon.
  const draftIds = sorted.filter((it) => it.status === 'draft').map((it) => it.id);
  const selectedDrafts = draftIds.filter((id) => selected.has(id));

  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const onValidateSelection = () => {
    if (selectedDrafts.length === 0) return;
    if (!confirm(`Valider ${selectedDrafts.length} brouillon${selectedDrafts.length > 1 ? 's' : ''} ?\n\nIls deviennent cherchables dans l'app dès que leur type est actif et porté par une case.`)) {
      return;
    }
    setError(null);
    startValidating(async () => {
      const res = await validateDraftsAction({ itemIds: selectedDrafts });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSelected(new Set());
      router.refresh();
    });
  };

  return (
    <section id="tout-le-catalogue" className="admin-card scroll-mt-24 overflow-hidden">
      <header className="flex flex-col gap-3 border-b border-admin-border bg-admin-bg/60 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-semibold">
            Tout le catalogue ({filtered.length}
            {filtered.length !== items.length ? ` / ${items.length}` : ''})
          </span>
          {draftIds.length > 0 ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelected(new Set(selectedDrafts.length === draftIds.length ? [] : draftIds))}
                className="rounded-md border border-admin-border bg-admin-bg px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] hover:bg-admin-ink hover:text-bento-cream"
              >
                {selectedDrafts.length === draftIds.length ? 'Tout décocher' : `Cocher les ${draftIds.length} brouillons`}
              </button>
              <button
                type="button"
                onClick={onValidateSelection}
                disabled={validating || selectedDrafts.length === 0}
                className="rounded-md border-2 border-bento-ink bg-bento-yellow px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-bento-ink hover:-translate-y-0.5 disabled:opacity-50"
              >
                {validating ? 'Validation…' : `Valider la sélection (${selectedDrafts.length})`}
              </button>
            </div>
          ) : null}
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
          {types.map((t) => (
            <FilterChip key={t.key} active={typeFilter === t.key} onClick={() => setTypeFilter(t.key)}>
              {typeOptionLabel(t)}
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
                <th className="w-8 pl-4 py-2 font-medium" aria-label="Sélection" />
                <SortHeader label="Type" sortKey="type" sort={sort} onSort={onSort} className="px-2" />
                <SortHeader label="Titre" sortKey="title" sort={sort} onSort={onSort} />
                <SortHeader label="Sous-titre" sortKey="subtitle" sort={sort} onSort={onSort} />
                <SortHeader label="Date" sortKey="date" sort={sort} onSort={onSort} />
                <SortHeader label="Img" sortKey="img" sort={sort} onSort={onSort} className="text-center" />
                <SortHeader label="Statut" sortKey="status" sort={sort} onSort={onSort} />
                <SortHeader label="Bentos" sortKey="bentos" sort={sort} onSort={onSort} className="text-center" />
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {sorted.map((it) => {
                const meta = STATUS_META[it.status];
                const open = openImageId === it.id;
                return (
                  <Fragment key={it.id}>
                    <tr className="hover:bg-admin-bg/50">
                      <td className="w-8 pl-4 py-2">
                        {it.status === 'draft' ? (
                          <input
                            type="checkbox"
                            checked={selected.has(it.id)}
                            onChange={() => toggle(it.id)}
                            aria-label={`Sélectionner le brouillon ${it.title}`}
                          />
                        ) : null}
                      </td>
                      <td className="px-2 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-admin-muted">
                        {it.typeLabel}
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
                      <td className="px-2 py-2 text-center font-mono text-[11px]">
                        {it.bentoCount > 0 ? (
                          <span className="font-semibold text-bento-ink">{it.bentoCount}</span>
                        ) : (
                          <span className="text-admin-muted opacity-50">0</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => setOpenImageId((cur) => (cur === it.id ? null : it.id))}
                          className="rounded-md border border-admin-border bg-admin-bg px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] hover:bg-admin-ink hover:text-bento-cream"
                        >
                          {open ? 'Fermer' : 'Image'}
                        </button>
                      </td>
                    </tr>
                    {open ? (
                      <tr>
                        <td colSpan={9} className="px-4 pb-3">
                          <ImageSuggestionPanel itemId={it.id} setError={setError} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ─── Doublons probables ───────────────────────────────────────────────
   Items d'un même type au même titre, une fois normalisé. Le premier de
   chaque groupe est le canonique proposé : validé, puis le plus posé, puis
   illustré, puis le plus ancien. La fusion reprend `admin_merge_items`. */

function DuplicatesSection({
  groups,
  setError,
}: {
  groups: DuplicateGroupView[];
  setError: (e: string | null) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onMerge = (group: DuplicateGroupView) => {
    const [canonical, ...losers] = group.items;
    if (!canonical || losers.length === 0) return;
    if (
      !confirm(
        `Fusionner ${losers.map((l) => `« ${l.title} »`).join(', ')} dans « ${canonical.title} » ?\n\nLes bentos qui les portent passent au canonique, et leurs titres deviennent des alias.`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await mergeItems({ canonicalId: canonical.id, loserIds: losers.map((l) => l.id) });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <section className="admin-card overflow-hidden">
      <header className="border-b border-admin-border bg-admin-bg/60 px-4 py-3 text-[13px] font-semibold">
        Doublons probables ({groups.length})
      </header>
      <ul className="flex flex-col divide-y divide-admin-border">
        {groups.map((g) => (
          <li key={g.items.map((i) => i.id).join(':')} className="flex items-start gap-4 px-4 py-3">
            {/* Largeurs fixes : les titres d'un groupe, et d'un groupe à l'autre, s'alignent. */}
            <span className="mt-0.5 w-[96px] shrink-0 truncate font-mono text-[10px] uppercase tracking-[0.12em] text-admin-muted">
              {g.typeLabel}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              {g.items.map((i, index) => (
                <div key={i.id} className="flex items-center gap-2 text-[13px]">
                  <span className="w-[72px] shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-admin-muted">
                    {index === 0 ? 'garder' : 'fusionner'}
                  </span>
                  <Link href={`/catalogue/${i.id}`} className="truncate font-semibold underline-offset-2 hover:underline">
                    {i.title}
                  </Link>
                  <span className="font-mono text-[10px] text-admin-muted">
                    {STATUS_META[i.status].label} · {i.bentoCount} bento{i.bentoCount > 1 ? 's' : ''}
                    {i.hasImage ? ' · image' : ''}
                  </span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onMerge(g)}
              disabled={pending}
              className="shrink-0 rounded-md border-2 border-bento-ink bg-bento-cream px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] hover:-translate-y-0.5 disabled:opacity-50"
            >
              Fusionner
            </button>
          </li>
        ))}
      </ul>
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
