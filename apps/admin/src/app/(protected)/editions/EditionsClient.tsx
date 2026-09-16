'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EDITION_STATUS_LABELS, type EditionRow } from '@/lib/editions';
import { createEditionAction, deleteEditionAction } from './actions';

/** Jeudi 18 h de Paris, la sortie retenue au chantier 13 (D4). */
const JOUR_DE_SORTIE = 4;
const HEURE_DE_SORTIE = 18;

/**
 * Le prochain jeudi 18 h, en heure locale, au format d'un `datetime-local`.
 *
 * Le champ HTML travaille en heure locale et sans fuseau : c'est la même
 * heure que celle de l'équipe, donc celle de Paris. La conversion en instant
 * se fait à l'enregistrement, par `new Date(valeur).toISOString()`.
 */
function prochaineSortie(depuis: Date = new Date()): string {
  const d = new Date(depuis);
  d.setHours(HEURE_DE_SORTIE, 0, 0, 0);
  const avance = (JOUR_DE_SORTIE - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + (avance === 0 && d <= depuis ? 7 : avance));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', {
    weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export function EditionsClient({ editions }: { editions: EditionRow[] }) {
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <div className="admin-card border-bento-red bg-bento-red/10 px-4 py-3 text-[13px] text-bento-red">
          {error}
        </div>
      )}

      <NewEditionForm setError={setError} />

      <section className="admin-card overflow-hidden">
        <header className="border-b border-admin-border bg-admin-bg/60 px-4 py-3 text-[13px] font-semibold">
          Éditions
        </header>
        {editions.length === 0 ? (
          <div className="p-6 text-[14px] text-admin-muted">
            Aucune édition. La première sortira quand tu lui donneras une date.
          </div>
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-admin-border text-left font-mono text-[10px] uppercase tracking-[0.18em] text-admin-muted">
                <th className="px-4 py-2 font-medium">Titre</th>
                <th className="px-2 py-2 font-medium">Adresse</th>
                <th className="px-2 py-2 font-medium">Sortie</th>
                <th className="px-2 py-2 font-medium">Cases</th>
                <th className="px-2 py-2 font-medium">Composée</th>
                <th className="px-4 py-2 text-right font-medium">État</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {editions.map((e) => (
                <EditionLine key={e.id} edition={e} setError={setError} />
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function EditionLine({
  edition,
  setError,
}: {
  edition: EditionRow;
  setError: (e: string | null) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onDelete = () => {
    if (
      !confirm(
        `Supprimer « ${edition.title} » ?\n\n` +
          `Ses ${edition.cases} case(s) partent avec elle.\n` +
          `Cette action est définitive.`,
      )
    ) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteEditionAction(edition.id);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <tr className="hover:bg-admin-bg/40">
      <td className="px-4 py-2">
        <Link href={`/editions/${edition.id}`} className="font-semibold underline-offset-2 hover:underline">
          {edition.title}
        </Link>
      </td>
      <td className="whitespace-nowrap px-2 py-2 font-mono text-[12px] text-admin-muted">/{edition.slug}</td>
      <td className="whitespace-nowrap px-2 py-2 font-mono text-[12px]">{formatDate(edition.releasedAt)}</td>
      <td className="px-2 py-2 font-mono text-[12px]">{edition.cases}</td>
      <td className="px-2 py-2 font-mono text-[12px]">{edition.composed}</td>
      <td className="px-4 py-2">
        {/* Une seule ligne : la pastille et l'action passaient l'une sous
            l'autre dès que la colonne se resserrait. */}
        <div className="flex items-center justify-end gap-2 whitespace-nowrap">
          <span className="inline-block rounded-full border-2 border-bento-ink px-2 py-px font-mono text-[9px] uppercase tracking-[0.12em]">
            {EDITION_STATUS_LABELS[edition.status]}
          </span>
          {edition.composed === 0 && (
            <button
              type="button"
              onClick={onDelete}
              disabled={pending}
              className="admin-btn admin-btn-danger admin-btn-sm h-[26px] py-0"
            >
              {pending ? '…' : 'Supprimer'}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function NewEditionForm({ setError }: { setError: (e: string | null) => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [releasedAt, setReleasedAt] = useState('');

  const onCreate = () => {
    setError(null);
    startTransition(async () => {
      const res = await createEditionAction({
        title,
        slug,
        releasedAt: releasedAt ? new Date(releasedAt).toISOString() : null,
      });
      if (!res.ok) { setError(res.error); return; }
      setTitle(''); setSlug(''); setReleasedAt('');
      router.push(`/editions/${res.id}`);
    });
  };

  return (
    <section className="admin-card p-4">
      <h2 className="mb-3 text-[13px] font-semibold">Nouvelle édition</h2>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
            Titre
          </span>
          <input
            id="edition-title"
            className="admin-input h-[34px] w-[280px] py-0 text-[13px]"
            value={title}
            maxLength={80}
            placeholder="La semaine du film qui pique"
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
            Adresse
          </span>
          <input
            id="edition-slug"
            className="admin-input h-[34px] w-[200px] py-0 font-mono text-[13px]"
            value={slug}
            maxLength={40}
            placeholder="semaine-38"
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
            Sortie
          </span>
          <input
            id="edition-released"
            type="datetime-local"
            className="admin-input h-[34px] w-[210px] py-0 font-mono text-[13px]"
            value={releasedAt}
            onChange={(e) => setReleasedAt(e.target.value)}
          />
        </label>

        <button
          type="button"
          className="admin-btn admin-btn-sm h-[34px] py-0"
          onClick={() => setReleasedAt(prochaineSortie())}
        >
          Jeudi 18 h
        </button>

        <button
          type="button"
          className="admin-btn admin-btn-primary h-[34px] py-0"
          onClick={onCreate}
          disabled={pending || title.trim().length === 0 || slug.trim().length < 3}
        >
          {pending ? 'Création…' : 'Créer'}
        </button>
      </div>
      <p className="mt-3 text-[12px] text-admin-muted">
        Sans date, l’édition reste un brouillon que personne ne voit. Une date à venir
        l’annonce sans dévoiler ses cases : elles ne sont pas lisibles avant l’heure.
      </p>
    </section>
  );
}
