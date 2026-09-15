'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  deactivationBlocker,
  validateItemTypeInput,
  type ItemTypeRow,
} from '@/lib/catalogue-types';
import { createTypeAction, setTypeActiveAction, updateTypeAction } from './actions';

export function TypesClient({ types }: { types: ItemTypeRow[] }) {
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

      <NewTypeForm nextOrder={Math.max(0, ...types.map((t) => t.order)) + 1} setError={setError} />
    </div>
  );
}

function TypeRow({ type, setError }: { type: ItemTypeRow; setError: (e: string | null) => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState(type.label);
  const [order, setOrder] = useState(String(type.order));
  const dirty = label.trim() !== type.label || order.trim() !== String(type.order);
  const blocker = type.active ? deactivationBlocker(type) : null;

  const onSave = () => {
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
          onChange={(e) => setOrder(e.target.value)}
          inputMode="numeric"
          maxLength={3}
        />
      </td>
      <td className="px-2 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-admin-muted">
        {type.cases.length > 0 ? type.cases.join(' · ') : 'aucune'}
      </td>
      <td className="px-2 py-2 text-center font-mono text-[11px]">{type.counts.validated}</td>
      <td className="px-2 py-2 text-center font-mono text-[11px]">{type.counts.pending}</td>
      <td className="px-2 py-2 text-center font-mono text-[11px]">{type.counts.draft}</td>
      <td className="px-4 py-2">
        <div className="flex items-center justify-end gap-2">
          {dirty ? (
            <button
              type="button"
              onClick={onSave}
              disabled={pending}
              className="admin-btn admin-btn-primary admin-btn-sm"
            >
              Enregistrer
            </button>
          ) : null}
          <button
            type="button"
            onClick={onToggle}
            disabled={pending || blocker !== null}
            title={blocker ?? undefined}
            className={`rounded-full border-2 border-bento-ink px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-60 ${
              type.active ? 'bg-bento-yellow text-bento-ink' : 'bg-admin-bg text-admin-muted'
            }`}
          >
            {type.active ? 'actif' : 'inactif'}
          </button>
        </div>
      </td>
    </tr>
  );
}

function NewTypeForm({
  nextOrder,
  setError,
}: {
  nextOrder: number;
  setError: (e: string | null) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [order, setOrder] = useState(String(nextOrder));

  const check = validateItemTypeInput({ key, label, order: Number(order) });

  const onCreate = () => {
    if (!check.ok) {
      setError(check.error);
      return;
    }
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
            placeholder="board_game"
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
            placeholder="Jeu de société"
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
            onChange={(e) => setOrder(e.target.value)}
            inputMode="numeric"
            maxLength={3}
          />
        </label>
        <button
          type="button"
          onClick={onCreate}
          disabled={pending || key.length === 0 || label.trim().length === 0}
          className="admin-btn admin-btn-primary"
        >
          {pending ? 'Création…' : 'Créer, inactif'}
        </button>
      </div>
      {key.length > 0 && !check.ok ? (
        <div className="border-t border-admin-border px-4 py-2 text-[12px] text-admin-muted">
          {check.error}
        </div>
      ) : null}
    </section>
  );
}
