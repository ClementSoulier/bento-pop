'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { retypeBlockers, STATUS_LABELS, type ItemUsage } from '@/lib/catalogue-types';
import { mergeItems, searchAnyItems, type AnyItemMatch } from '../actions';
import {
  addAlias,
  changeItemTypeAction,
  deleteAlias,
  removeItemImage,
  updateItemMeta,
  uploadItemImage,
  validateDraftAction,
} from './actions';

export type ItemDetail = {
  id: string;
  title: string;
  subtitle: string | null;
  year: number | null;
  imageUrl: string | null;
  imageCredit: string | null;
  status: 'draft' | 'pending' | 'validated' | 'rejected' | 'merged';
  externalSource: string;
  /** Intitulé long de la case d'origine, `null` pour un item créé sans case. */
  caseLabel: string | null;
  typeId: number;
  typeLabel: string;
  submittedByPseudo: string | null;
  submittedAt: string | null;
  validatedAt: string | null;
  rejectedAt: string | null;
  rejectedReason: string | null;
  mergedIntoId: string | null;
  createdAt: string;
  aliases: { id: string; alias: string }[];
};

export type TypeChoice = { id: number; key: string; label: string; active: boolean };

/** Une case où l'item est posé, avec le pseudo du bento. */
export type Placement = ItemUsage & { pseudo: string };

export function ItemEditClient({
  item,
  types,
  placements,
}: {
  item: ItemDetail;
  types: TypeChoice[];
  placements: Placement[];
}) {
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-6">
        {error ? (
          <div className="admin-card border-bento-red bg-bento-red/10 px-4 py-3 text-[13px] text-bento-red">
            {error}
          </div>
        ) : null}

        {item.status === 'draft' ? <DraftBanner item={item} setError={setError} /> : null}
        <MetaSection item={item} setError={setError} />
        <TypeSection item={item} types={types} placements={placements} setError={setError} />
        <AliasSection item={item} setError={setError} />
        {item.status !== 'merged' ? <MergeSection item={item} setError={setError} /> : null}
      </div>

      <aside className="flex flex-col gap-6">
        <ImageSection item={item} setError={setError} />
        <AuditSection item={item} />
      </aside>
    </div>
  );
}

/* ─── Édition titre / sous-titre / année ───────────────────────────── */

function MetaSection({
  item,
  setError,
}: {
  item: ItemDetail;
  setError: (e: string | null) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(item.title);
  const [subtitle, setSubtitle] = useState(item.subtitle ?? '');
  const [year, setYear] = useState(item.year !== null ? String(item.year) : '');

  const dirty =
    title.trim() !== item.title ||
    subtitle.trim() !== (item.subtitle ?? '') ||
    year.trim() !== (item.year !== null ? String(item.year) : '');

  const onSave = () => {
    setError(null);
    startTransition(async () => {
      const parsedYear = year.trim() === '' ? null : Number.parseInt(year, 10);
      const res = await updateItemMeta({
        itemId: item.id,
        title: title.trim(),
        subtitle: subtitle.trim() === '' ? null : subtitle.trim(),
        year: Number.isFinite(parsedYear) ? (parsedYear as number) : null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <section>
      <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-admin-muted">
        Métadonnées
      </h2>
      <div className="admin-card overflow-hidden">
        <div className="grid grid-cols-1 gap-4 px-6 py-5">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
              Titre
            </span>
            <input
              className="admin-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </label>
          <div className="grid grid-cols-[1fr_120px] gap-4">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
                Sous-titre (optionnel)
              </span>
              <input
                className="admin-input"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                maxLength={280}
                placeholder="ex : Christopher Nolan, 2010"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
                Année
              </span>
              <input
                className="admin-input font-mono"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                inputMode="numeric"
                placeholder="2010"
                maxLength={4}
              />
            </label>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-admin-border bg-admin-bg/40 px-6 py-3">
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            disabled={!dirty || pending}
            onClick={onSave}
          >
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </section>
  );
}

/* ─── Brouillon ────────────────────────────────────────────────────── */

function DraftBanner({ item, setError }: { item: ItemDetail; setError: (e: string | null) => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onValidate = () => {
    if (!confirm(`Valider « ${item.title} » ?\n\nIl devient cherchable dans l'app dès que son type est actif et porté par une case.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await validateDraftAction({ itemId: item.id });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <div className="admin-card flex items-center justify-between gap-3 px-4 py-3 text-[13px]">
      <span>
        <strong>Brouillon.</strong> Invisible dans l&apos;app : un brouillon ne sort dans aucune recherche.
      </span>
      <button
        type="button"
        onClick={onValidate}
        disabled={pending}
        className="rounded-md border-2 border-bento-ink bg-bento-yellow px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-bento-ink hover:-translate-y-0.5 disabled:opacity-50"
      >
        {pending ? 'Validation…' : 'Valider'}
      </button>
    </div>
  );
}

/* ─── Type ─────────────────────────────────────────────────────────── */

/**
 * Changer le type d'un item mal rangé, par exemple « Arcane » proposée comme
 * créateur. Les cases qui l'empêchent sont affichées avant d'essayer : la base
 * refuse qu'un item posé dans une case d'un autre type en change.
 */
function TypeSection({
  item,
  types,
  placements,
  setError,
}: {
  item: ItemDetail;
  types: TypeChoice[];
  placements: Placement[];
  setError: (e: string | null) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [typeId, setTypeId] = useState(item.typeId);
  const blockers = typeId === item.typeId ? [] : retypeBlockers(placements, typeId);
  const target = types.find((t) => t.id === typeId);

  const onChange = () => {
    if (!target || typeId === item.typeId || blockers.length > 0) return;
    if (!confirm(`Passer « ${item.title} » de ${item.typeLabel} à ${target.label} ?\n\nIl ne sortira plus dans la recherche de ses anciennes cases.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await changeItemTypeAction({ itemId: item.id, typeId });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <section>
      <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-admin-muted">Type</h2>
      <div className="admin-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-6 py-4 text-[13px]">
          <span>
            Rangé en <strong>{item.typeLabel}</strong>
            {item.caseLabel ? <span className="text-admin-muted">, proposé dans la case {item.caseLabel}</span> : null}
          </span>
          <select
            className="admin-input w-[200px]"
            value={typeId}
            onChange={(e) => setTypeId(Number(e.target.value))}
          >
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.active ? t.label : `${t.label} (inactif)`}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onChange}
            disabled={pending || typeId === item.typeId || blockers.length > 0}
            className="admin-btn admin-btn-primary"
          >
            {pending ? 'Changement…' : 'Changer le type'}
          </button>
        </div>
        {blockers.length > 0 ? (
          <div className="border-t border-admin-border bg-admin-bg/40 px-6 py-3 text-[12px]">
            <p className="mb-2">
              Posé dans {blockers.length} case{blockers.length > 1 ? 's' : ''} d&apos;un autre type : retire-le de ces
              bentos avant de changer son type.
            </p>
            <ul className="flex flex-col gap-1">
              {blockers.map((b) => (
                <li key={`${b.bentoId}:${b.caseKey}`} className="flex items-baseline gap-2">
                  <Link href={`/bentos/${b.bentoId}`} className="font-semibold underline-offset-2 hover:underline">
                    @{b.pseudo}
                  </Link>
                  <span className="text-admin-muted">case {b.caseLabel}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ─── Fusion ───────────────────────────────────────────────────────── */

/**
 * Fusionner cet item dans un autre du même type : ses bentos passent à
 * l'autre, son titre devient un alias. Sert aux doublons, par exemple une
 * Personne proposée jadis comme artiste et comme créateur.
 */
function MergeSection({ item, setError }: { item: ItemDetail; setError: (e: string | null) => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<AnyItemMatch[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onQueryChange = (q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (q.trim().length < 2) {
        setMatches([]);
        return;
      }
      const res = await searchAnyItems({ q, typeId: item.typeId, excludeId: item.id });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMatches(res.matches.filter((m) => m.status !== 'rejected'));
    }, 250);
  };

  const onMergeInto = (canonical: AnyItemMatch) => {
    if (
      !confirm(
        `Fusionner « ${item.title} » dans « ${canonical.title} » ?\n\nSes bentos passent à « ${canonical.title} », et son titre devient un alias. L'opération ne se défait pas.`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await mergeItems({ canonicalId: canonical.id, loserIds: [item.id] });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/catalogue/${canonical.id}`);
    });
  };

  return (
    <section>
      <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-admin-muted">
        Fusionner dans un autre item
      </h2>
      <div className="admin-card overflow-hidden">
        <div className="px-4 py-3">
          <input
            className="admin-input w-full"
            placeholder={`Chercher un item de type ${item.typeLabel}…`}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
        </div>
        {matches.length > 0 ? (
          <ul className="flex flex-col divide-y divide-admin-border border-t border-admin-border">
            {matches.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-2 text-[13px]">
                <span className="rounded border border-admin-border bg-admin-bg px-1.5 py-px font-mono text-[9px] uppercase tracking-[0.12em] text-admin-muted">
                  {STATUS_LABELS[m.status]}
                </span>
                <Link href={`/catalogue/${m.id}`} className="flex-1 truncate font-semibold underline-offset-2 hover:underline">
                  {m.title}
                </Link>
                <button
                  type="button"
                  onClick={() => onMergeInto(m)}
                  disabled={pending}
                  className="rounded-md border-2 border-bento-ink bg-bento-cream px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] hover:-translate-y-0.5 disabled:opacity-50"
                >
                  Fusionner ici
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

/* ─── Aliases ──────────────────────────────────────────────────────── */

function AliasSection({
  item,
  setError,
}: {
  item: ItemDetail;
  setError: (e: string | null) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newAlias, setNewAlias] = useState('');

  const onAdd = () => {
    const alias = newAlias.trim();
    if (alias.length < 1) return;
    setError(null);
    startTransition(async () => {
      const res = await addAlias({ itemId: item.id, alias });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setNewAlias('');
      router.refresh();
    });
  };

  const onDelete = (aliasId: string) => {
    setError(null);
    startTransition(async () => {
      const res = await deleteAlias({ aliasId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <section>
      <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-admin-muted">
        Alias ({item.aliases.length})
      </h2>
      <div className="admin-card overflow-hidden">
        {item.aliases.length > 0 ? (
          <ul className="flex flex-col divide-y divide-admin-border">
            {item.aliases.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="flex-1 text-[13px]">{a.alias}</span>
                <button
                  type="button"
                  onClick={() => onDelete(a.id)}
                  disabled={pending}
                  className="font-mono text-[10px] uppercase tracking-[0.12em] text-admin-muted hover:text-bento-red disabled:opacity-50"
                >
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-4 py-4 text-center text-[12px] text-admin-muted">
            Aucun alias. Ajoute des variantes de titre pour améliorer la recherche
            fuzzy (ex : « La Guerre des Étoiles » pour « Star Wars »).
          </div>
        )}
        <div className="flex items-center gap-2 border-t border-admin-border bg-admin-bg/40 px-4 py-3">
          <input
            className="admin-input flex-1"
            placeholder="Nouvel alias…"
            value={newAlias}
            onChange={(e) => setNewAlias(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onAdd();
            }}
            maxLength={200}
          />
          <button
            type="button"
            onClick={onAdd}
            disabled={pending || newAlias.trim().length === 0}
            className="admin-btn admin-btn-primary"
          >
            Ajouter
          </button>
        </div>
      </div>
    </section>
  );
}

/* ─── Image (preview + upload + remove) ─────────────────────────────── */

function ImageSection({
  item,
  setError,
}: {
  item: ItemDetail;
  setError: (e: string | null) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [attribution, setAttribution] = useState(item.imageCredit ?? '');

  const onUpload = async (formData: FormData) => {
    setError(null);
    formData.set('attribution', attribution);
    startTransition(async () => {
      const res = await uploadItemImage(item.id, formData);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  const onRemove = () => {
    if (!confirm('Retirer l\'image associée à cet item ?')) return;
    setError(null);
    startTransition(async () => {
      const res = await removeItemImage({ itemId: item.id });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <section>
      <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-admin-muted">
        Illustration
      </h2>
      <div className="admin-card overflow-hidden">
        {item.imageUrl ? (
          <div className="aspect-[3/4] w-full bg-admin-bg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.imageUrl}
              alt={item.title}
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="aspect-[3/4] w-full bg-admin-bg flex items-center justify-center text-[12px] text-admin-muted">
            Pas d&apos;image
          </div>
        )}
        <form action={onUpload} className="flex flex-col gap-3 border-t border-admin-border bg-admin-bg/40 px-4 py-3">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
              Crédit (affiché en mini sous l&apos;image)
            </span>
            <input
              className="admin-input"
              value={attribution}
              onChange={(e) => setAttribution(e.target.value)}
              placeholder="ex : Photo : Studio XY (Tous droits réservés)"
              maxLength={500}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
              Fichier (jpg/png/webp, max 8 Mo)
            </span>
            <input
              type="file"
              name="file"
              accept="image/*"
              className="block w-full text-[12px] text-admin-ink file:mr-3 file:rounded-md file:border file:border-admin-border file:bg-admin-bg file:px-3 file:py-1.5 file:text-[11px] file:font-mono file:uppercase file:tracking-[0.12em] hover:file:bg-admin-ink hover:file:text-bento-cream"
              required
            />
          </label>
          <div className="flex items-center justify-between gap-3">
            {item.imageUrl ? (
              <button
                type="button"
                onClick={onRemove}
                disabled={pending}
                className="font-mono text-[10px] uppercase tracking-[0.12em] text-admin-muted hover:text-bento-red disabled:opacity-50"
              >
                Retirer l&apos;image
              </button>
            ) : (
              <span />
            )}
            <button
              type="submit"
              disabled={pending}
              className="admin-btn admin-btn-primary"
            >
              {pending ? 'Upload…' : 'Uploader'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

/* ─── Audit metadata ───────────────────────────────────────────────── */

function AuditSection({ item }: { item: ItemDetail }) {
  return (
    <section>
      <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-admin-muted">
        Traçabilité
      </h2>
      <div className="admin-card px-4 py-3 text-[12px]">
        <dl className="grid grid-cols-[110px_1fr] gap-y-2">
          <Row label="Statut" value={STATUS_LABELS[item.status]} />
          <Row label="Type" value={item.typeLabel} />
          <Row label="Case d'origine" value={item.caseLabel ?? 'aucune'} />
          <Row label="Source" value={item.externalSource} />
          {item.submittedByPseudo ? (
            <Row label="Soumis par" value={`@${item.submittedByPseudo}`} />
          ) : null}
          {item.submittedAt ? (
            <Row label="Soumis le" value={formatDate(item.submittedAt)} />
          ) : null}
          {item.validatedAt ? (
            <Row label="Validé le" value={formatDate(item.validatedAt)} />
          ) : null}
          {item.rejectedAt ? (
            <Row label="Refusé le" value={formatDate(item.rejectedAt)} />
          ) : null}
          {item.rejectedReason ? (
            <Row label="Motif refus" value={item.rejectedReason} />
          ) : null}
          {item.mergedIntoId ? (
            <Row
              label="Mergé dans"
              value={
                <a className="font-mono underline" href={`/catalogue/${item.mergedIntoId}`}>
                  {item.mergedIntoId.slice(0, 8)}…
                </a>
              }
            />
          ) : null}
          <Row label="Créé le" value={formatDate(item.createdAt)} />
        </dl>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-admin-muted">
        {label}
      </dt>
      <dd className="text-admin-ink">{value}</dd>
    </>
  );
}

function formatDate(s: string): string {
  return new Date(s).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
