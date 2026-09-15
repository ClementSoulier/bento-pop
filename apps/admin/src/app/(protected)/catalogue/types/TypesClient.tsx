'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  deactivationBlocker,
  validateItemTypeInput,
  type ItemTypeRow,
} from '@/lib/catalogue-types';
import type { StarterStatus } from '@/lib/starter-import';
import {
  createTypeAction,
  importStarterListAction,
  setTypeActiveAction,
  updateTypeAction,
} from './actions';

const ORDER_ERROR = 'Ordre : un entier de 0 à 999.';

/** Un champ d'ordre ne garde que des chiffres : « abc » ne s'y tape pas. */
const digitsOnly = (value: string) => value.replace(/\D/g, '');

export function TypesClient({ types, starters }: { types: ItemTypeRow[]; starters: StarterStatus[] }) {
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <div className="admin-card border-bento-red bg-bento-red/10 px-4 py-3 text-[13px] text-bento-red">
          {error}
        </div>
      ) : null}

      <section className="admin-card overflow-hidden">
        <header className="border-b border-admin-border bg-admin-bg/60 px-4 py-3 text-[13px] font-semibold">
          Types ({types.length})
        </header>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-admin-border text-left font-mono text-[9px] uppercase tracking-[0.15em] text-admin-muted">
                <th className="px-4 py-2 font-medium">Clé</th>
                <th className="px-2 py-2 font-medium">Libellé</th>
                <th className="px-2 py-2 font-medium">Ordre</th>
                <th className="px-2 py-2 font-medium">Cases du bento principal</th>
                <th className="px-2 py-2 text-center font-medium">Validés</th>
                <th className="px-2 py-2 text-center font-medium">En attente</th>
                <th className="px-2 py-2 text-center font-medium">Brouillons</th>
                <th className="px-4 py-2 text-right font-medium">État</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {types.map((t) => (
                <TypeRow key={t.id} type={t} setError={setError} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {starters.length > 0 ? (
        <StarterSection
          starters={starters}
          draftsByType={new Map(types.map((t) => [t.key, t.counts.draft]))}
        />
      ) : null}

      <NewTypeForm
        nextOrder={Math.max(0, ...types.map((t) => t.order)) + 1}
        existingKeys={types.map((t) => t.key)}
        setError={setError}
      />
    </div>
  );
}

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

type StarterMessage = { tone: 'ok' | 'error'; text: string };

/**
 * Les listes de départ des nouveaux types, saisies en interne et importées en
 * brouillons. Le compte « déjà au catalogue » inclut ce que l'équipe a saisi
 * elle-même : ces titres ne sont pas importés une seconde fois. Le résultat
 * d'un import s'affiche dans la section, là où l'on vient de cliquer.
 */
function StarterSection({
  starters,
  draftsByType,
}: {
  starters: StarterStatus[];
  draftsByType: ReadonlyMap<string, number>;
}) {
  const [message, setMessage] = useState<StarterMessage | null>(null);

  return (
    <section className="admin-card overflow-hidden">
      <header className="border-b border-admin-border bg-admin-bg/60 px-4 py-3 text-[13px] font-semibold">
        Listes de départ
      </header>
      <p className="border-b border-admin-border px-4 py-2.5 text-[12px] text-admin-muted">
        Des candidats saisis en interne, importés en brouillons : invisibles dans l&apos;app, à relire
        et valider depuis le catalogue. Relancer un import ne crée pas de doublon.
      </p>
      <ul className="divide-y divide-admin-border">
        {starters.map((s) => (
          <StarterRow
            key={s.typeKey}
            starter={s}
            drafts={draftsByType.get(s.typeKey) ?? 0}
            setMessage={setMessage}
          />
        ))}
      </ul>
      {/* Sous la liste : les lignes ne bougent pas sous le pointeur quand le message paraît. */}
      {message ? (
        <div
          role="status"
          className={`border-t border-admin-border px-4 py-2.5 text-[13px] ${
            message.tone === 'error' ? 'bg-bento-red/10 text-bento-red' : 'bg-bento-yellow/20'
          }`}
        >
          {message.text}
        </div>
      ) : null}
    </section>
  );
}

function StarterRow({
  starter,
  drafts,
  setMessage,
}: {
  starter: StarterStatus;
  drafts: number;
  setMessage: (m: StarterMessage | null) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onImport = () => {
    if (
      !confirm(
        `Importer ${plural(starter.toInsert, 'brouillon')} dans ${starter.typeLabel} ?\n\nIls restent invisibles dans l'app jusqu'à leur validation.`,
      )
    ) {
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const res = await importStarterListAction({ typeKey: starter.typeKey });
      if (!res.ok) {
        setMessage({ tone: 'error', text: res.error });
        return;
      }
      setMessage({
        tone: 'ok',
        text:
          `${starter.typeLabel} : ${plural(res.inserted, 'brouillon')} importé${res.inserted > 1 ? 's' : ''}` +
          (res.alreadyThere > 0 ? `, ${res.alreadyThere} déjà au catalogue.` : '.'),
      });
      router.refresh();
    });
  };

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13px]">
      <span className="w-[120px] shrink-0 font-semibold">{starter.typeLabel}</span>
      <span className="min-w-[220px] flex-1 font-mono text-[11px] text-admin-muted">
        {plural(starter.candidates, 'candidat')} · {starter.alreadyThere} déjà au catalogue
      </span>
      {drafts > 0 ? (
        <Link
          href={`/catalogue?type=${starter.typeKey}&statut=draft#tout-le-catalogue`}
          className="font-mono text-[10px] uppercase tracking-[0.12em] text-admin-muted underline-offset-2 hover:text-admin-ink hover:underline"
        >
          Relire {plural(drafts, 'brouillon')}
        </Link>
      ) : null}
      <button
        type="button"
        onClick={onImport}
        disabled={pending || starter.toInsert === 0}
        className="admin-btn admin-btn-primary admin-btn-sm h-[30px] w-[190px] py-0"
      >
        {pending
          ? 'Import…'
          : starter.toInsert === 0
            ? 'Tout est importé'
            : `Importer ${plural(starter.toInsert, 'brouillon')}`}
      </button>
    </li>
  );
}

function StatePill({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-block rounded-full border-2 border-bento-ink px-2 py-px font-mono text-[9px] uppercase tracking-[0.12em] ${
        active ? 'bg-bento-yellow text-bento-ink' : 'bg-admin-bg text-admin-muted'
      }`}
    >
      {active ? 'actif' : 'inactif'}
    </span>
  );
}

function TypeRow({ type, setError }: { type: ItemTypeRow; setError: (e: string | null) => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState(type.label);
  const [order, setOrder] = useState(String(type.order));
  const dirty = label.trim() !== type.label || order !== String(type.order);
  const blocker = type.active ? deactivationBlocker(type) : null;

  const onSave = () => {
    if (!/^\d{1,3}$/.test(order)) {
      setError(ORDER_ERROR);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await updateTypeAction({ id: type.id, label, order: Number(order) });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  };

  const onToggle = () => {
    const next = !type.active;
    if (
      next &&
      !confirm(
        `Activer « ${type.label} » ?\n\nSes items validés deviennent cherchables dans l'app dès qu'une case porte ce type.`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await setTypeActiveAction({ id: type.id, active: next });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <tr className="hover:bg-admin-bg/50">
      <td className="px-4 py-2 font-mono text-[11px]">{type.key}</td>
      <td className="px-2 py-2">
        <input
          className="admin-input h-[30px] w-[180px] py-0 text-[12px]"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={40}
        />
      </td>
      <td className="px-2 py-2">
        <input
          className="admin-input h-[30px] w-[64px] py-0 font-mono text-[12px]"
          value={order}
          onChange={(e) => setOrder(digitsOnly(e.target.value))}
          inputMode="numeric"
          maxLength={3}
        />
      </td>
      <td className="px-2 py-2 text-admin-muted">
        {type.cases.length > 0 ? type.cases.join(' · ') : 'aucune'}
      </td>
      <td className="px-2 py-2 text-center font-mono text-[11px]">{type.counts.validated}</td>
      <td className="px-2 py-2 text-center font-mono text-[11px]">{type.counts.pending}</td>
      <td className="px-2 py-2 text-center font-mono text-[11px]">{type.counts.draft}</td>
      <td className="px-4 py-2">
        <div className="flex items-center justify-end gap-2">
          {/* Toujours rendu, masqué tant que rien ne change : la ligne ne bouge pas à la saisie. */}
          <button
            type="button"
            onClick={onSave}
            disabled={pending || !dirty}
            className={`admin-btn admin-btn-primary admin-btn-sm h-[30px] py-0 ${dirty ? '' : 'invisible'}`}
          >
            Enregistrer
          </button>
          {blocker ? (
            <span title={blocker} className="cursor-help">
              <StatePill active={type.active} />
            </span>
          ) : (
            <button
              type="button"
              onClick={onToggle}
              disabled={pending}
              aria-pressed={type.active}
              title={type.active ? 'Désactiver ce type' : 'Activer ce type'}
              className="rounded-full transition hover:-translate-y-0.5 disabled:opacity-50"
            >
              <StatePill active={type.active} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function NewTypeForm({
  nextOrder,
  existingKeys,
  setError,
}: {
  nextOrder: number;
  existingKeys: readonly string[];
  setError: (e: string | null) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [order, setOrder] = useState(String(nextOrder));

  const check = validateItemTypeInput({
    key,
    label,
    order: order === '' ? Number.NaN : Number(order),
  });
  const taken = existingKeys.includes(key.trim());
  const hint = key.length === 0 ? null : taken ? 'Cette clé de type existe déjà.' : check.ok ? null : check.error;

  const onCreate = () => {
    if (!check.ok || taken) return;
    if (
      !confirm(
        `Créer le type « ${check.value.label} » (clé ${check.value.key}) ?\n\nLa clé ne pourra plus être modifiée. Le type naît inactif.`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await createTypeAction(check.value);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setKey('');
      setLabel('');
      setOrder(String(check.value.order + 1));
      router.refresh();
    });
  };

  return (
    <section className="admin-card overflow-hidden">
      <header className="border-b border-admin-border bg-admin-bg/60 px-4 py-3 text-[13px] font-semibold">
        Nouveau type
      </header>
      <div className="flex flex-wrap items-end gap-3 px-4 py-3">
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
            Clé, définitive
          </span>
          <input
            className="admin-input w-[180px] font-mono"
            value={key}
            onChange={(e) => setKey(e.target.value.toLowerCase())}
            placeholder="manga"
            maxLength={20}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
            Libellé
          </span>
          <input
            className="admin-input w-[220px]"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Manga"
            maxLength={40}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
            Ordre
          </span>
          <input
            className="admin-input w-[80px] font-mono"
            value={order}
            onChange={(e) => setOrder(digitsOnly(e.target.value))}
            inputMode="numeric"
            maxLength={3}
          />
        </label>
        <button
          type="button"
          onClick={onCreate}
          disabled={pending || !check.ok || taken}
          className="admin-btn admin-btn-primary"
        >
          {pending ? 'Création…' : 'Créer, inactif'}
        </button>
      </div>
      {hint ? (
        <div className="border-t border-admin-border px-4 py-2 text-[12px] text-admin-muted">{hint}</div>
      ) : null}
    </section>
  );
}
