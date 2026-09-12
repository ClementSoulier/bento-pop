'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { checkPseudoShape } from '@/lib/pseudo-rules';
import { updateMobileUser } from './actions';
import {
  filterUsers,
  funnelShare,
  type Funnel,
  type OrphanRow,
  type UserListRow,
} from '@/lib/user-funnel';

type Tab = 'profils' | 'orphelins';
type Filter = 'tous' | 'publies' | 'sans-bento' | 'editorial';

type UsersClientProps = {
  funnel: Funnel;
  rows: UserListRow[];
  orphans: OrphanRow[];
};

export function UsersClient({ funnel, rows: initialRows, orphans }: UsersClientProps) {
  const [tab, setTab] = useState<Tab>('profils');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('tous');
  const [rows, setRows] = useState(initialRows);
  const [editing, setEditing] = useState<UserListRow | null>(null);

  const applyEdit = (userId: string, pseudo: string, displayName: string | null) => {
    setRows((prev) =>
      prev.map((r) => (r.id === userId ? { ...r, pseudo, displayName } : r)),
    );
  };

  const visible = useMemo(() => {
    const searched = filterUsers(rows, query);
    switch (filter) {
      case 'publies':
        return searched.filter((r) => r.publishedAt !== null);
      case 'sans-bento':
        return searched.filter((r) => r.slots === 0);
      case 'editorial':
        return searched.filter((r) => r.kind === 'editorial');
      default:
        return searched;
    }
  }, [rows, query, filter]);

  /**
   * Tant qu'aucune version instrumentée n'est déployée, plateforme et
   * version sont vides pour tout le monde. Une colonne vide sans explication
   * passe pour un bug, donc on le dit une fois, en tête.
   */
  const noTelemetry = rows.every((r) => r.platform === null);

  return (
    <div className="space-y-5">
      <FunnelBar funnel={funnel} />

      <div className="flex flex-wrap items-center gap-2">
        <Tabs tab={tab} setTab={setTab} profils={rows.length} orphelins={orphans.length} />
      </div>

      {tab === 'profils' ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="admin-input max-w-xs"
              placeholder="Chercher un pseudo ou un nom…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              className="admin-select"
              value={filter}
              onChange={(e) => setFilter(e.target.value as Filter)}
            >
              <option value="tous">Tous les profils</option>
              <option value="publies">Bento publié</option>
              <option value="sans-bento">Sans bento</option>
              <option value="editorial">Profils éditoriaux</option>
            </select>
            <span className="text-[12px] text-admin-muted">
              {visible.length} sur {rows.length}
            </span>
          </div>

          {noTelemetry ? (
            <div className="admin-card px-4 py-3 text-[12px] text-admin-muted">
              Plateforme, version et dernière visite sont écrites par l&apos;app au
              démarrage. Elles resteront vides jusqu&apos;à ce que chacun installe une
              version instrumentée, et se rempliront progressivement.
            </div>
          ) : null}

          <ProfilesTable rows={visible} onEdit={setEditing} />
        </>
      ) : (
        <OrphansTable rows={orphans} />
      )}

      {editing ? (
        <EditDialog
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={(pseudo, displayName) => {
            applyEdit(editing.id, pseudo, displayName);
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Édition du pseudo et du nom affiché.
 *
 * Deux champs seulement : ce sont les deux demandes prévisibles, un pseudo
 * insultant et une coquille. Tout le reste est du contenu, qui a ses propres
 * écrans.
 *
 * Le contrôle de forme est immédiat, mais **la base reste l'arbitre** :
 * l'unicité et les motifs de modération ne se vérifient pas ici, et le refus
 * revient traduit par l'action.
 */
function EditDialog({
  row,
  onClose,
  onSaved,
}: {
  row: UserListRow;
  onClose: () => void;
  onSaved: (pseudo: string, displayName: string | null) => void;
}) {
  const [pseudo, setPseudo] = useState(row.pseudo);
  const [displayName, setDisplayName] = useState(row.displayName ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const shape = checkPseudoShape(pseudo);
  const pseudoChanged = pseudo.trim() !== row.pseudo;
  const nothingChanged = !pseudoChanged && (displayName.trim() === (row.displayName ?? ''));

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await updateMobileUser({ userId: row.id, pseudo: pseudo.trim(), displayName });
      if (res.ok) {
        onSaved(pseudo.trim(), displayName.trim() === '' ? null : displayName.trim());
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <div className="admin-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="admin-modal-content max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Modifier @${row.pseudo}`}
      >
        <h2 className="text-[16px] font-semibold">Modifier @{row.pseudo}</h2>

        <label className="mt-5 block text-[12px] font-medium">
          Pseudo
          <input
            className="admin-input mt-1 w-full"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            autoFocus
          />
        </label>
        {!shape.ok ? (
          <p className="mt-1 text-[12px] text-bento-red">{shape.message}</p>
        ) : null}
        {pseudoChanged && shape.ok ? (
          <p className="mt-1 text-[12px] text-admin-muted">
            L&apos;adresse publique deviendra <code className="font-mono">/u/{pseudo.trim()}</code>.
            L&apos;ancienne renverra une page introuvable.
          </p>
        ) : null}

        <label className="mt-4 block text-[12px] font-medium">
          Nom affiché
          <input
            className="admin-input mt-1 w-full"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="facultatif"
          />
        </label>

        {error ? (
          <p className="mt-4 rounded border border-bento-red bg-bento-red/10 px-3 py-2 text-[12px] text-bento-red">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="admin-btn admin-btn-ghost" onClick={onClose} disabled={pending}>
            Annuler
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={submit}
            disabled={pending || !shape.ok || nothingChanged}
          >
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * L'entonnoir, en tête d'écran.
 *
 * Trois nombres nommés plutôt qu'un « nombre d'utilisateurs » : 106
 * installations, 70 pseudos et 26 publications racontent trois choses
 * différentes, et les confondre fait prendre de mauvaises décisions.
 */
function FunnelBar({ funnel }: { funnel: Funnel }) {
  const steps = [
    { label: 'Installations', value: funnel.installs, share: 100 },
    { label: 'Pseudo choisi', value: funnel.members, share: funnelShare(funnel.members, funnel.installs) },
    { label: 'Bento commencé', value: funnel.started, share: funnelShare(funnel.started, funnel.installs) },
    { label: 'Bento publié', value: funnel.published, share: funnelShare(funnel.published, funnel.installs) },
  ];

  return (
    <div className="admin-card p-5">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {steps.map((s) => (
          <div key={s.label}>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-admin-muted">
              {s.label}
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-[26px] font-semibold leading-none">{s.value}</span>
              <span className="text-[12px] text-admin-muted">{s.share} %</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 border-t border-admin-border pt-3 text-[12px] text-admin-muted">
        {funnel.orphans} installation{funnel.orphans > 1 ? 's' : ''} sans pseudo
        {funnel.editorial > 0
          ? ` · ${funnel.editorial} profil${funnel.editorial > 1 ? 's' : ''} éditorial${funnel.editorial > 1 ? 'aux' : ''}, hors compteurs`
          : ''}
      </div>
    </div>
  );
}

function Tabs({
  tab,
  setTab,
  profils,
  orphelins,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  profils: number;
  orphelins: number;
}) {
  const entries: { id: Tab; label: string }[] = [
    { id: 'profils', label: `Profils (${profils})` },
    { id: 'orphelins', label: `Installations sans pseudo (${orphelins})` },
  ];
  return (
    <>
      {entries.map((e) => (
        <button
          key={e.id}
          type="button"
          onClick={() => setTab(e.id)}
          className={tab === e.id ? 'admin-btn admin-btn-sm admin-btn-primary' : 'admin-btn admin-btn-sm admin-btn-ghost'}
        >
          {e.label}
        </button>
      ))}
    </>
  );
}

function ProfilesTable({
  rows,
  onEdit,
}: {
  rows: UserListRow[];
  onEdit: (row: UserListRow) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="admin-card p-6 text-[14px] text-admin-muted">
        Aucun profil ne correspond.
      </div>
    );
  }

  return (
    <div className="admin-card overflow-hidden">
      <table className="w-full text-[13px]">
        <thead className="border-b border-admin-border bg-admin-bg/60">
          <tr className="text-left font-mono text-[10px] uppercase tracking-[0.18em] text-admin-muted">
            <th className="px-4 py-2.5">Pseudo</th>
            <th className="px-4 py-2.5">Nom</th>
            <th className="px-4 py-2.5">Bento</th>
            <th className="px-4 py-2.5">Inscrit le</th>
            <th className="px-4 py-2.5">Dernière visite</th>
            <th className="px-4 py-2.5">Appareil</th>
            <th className="px-4 py-2.5 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-admin-border last:border-b-0 hover:bg-admin-bg/40">
              <td className="px-4 py-3 font-semibold">
                <span className="inline-flex items-center gap-2">
                  <Link
                    href={`https://bento-pop.com/u/${r.pseudo}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline-offset-2 hover:underline"
                  >
                    @{r.pseudo}
                  </Link>
                  {r.kind === 'editorial' ? (
                    <span className="admin-badge admin-badge-info">Invité</span>
                  ) : null}
                  {/* Un membre sans compte d'authentification est anormal :
                      il vient d'une suppression faite hors du back-office. */}
                  {r.kind === 'member' && !r.hasAuthAccount ? (
                    <span className="admin-badge admin-badge-warn" title="Profil sans compte d'authentification">
                      Sans compte
                    </span>
                  ) : null}
                </span>
              </td>
              <td className="px-4 py-3 text-admin-muted">{r.displayName ?? '—'}</td>
              <td className="px-4 py-3">
                <BentoCell row={r} />
              </td>
              <td className="px-4 py-3 font-mono text-[11px] text-admin-muted">{shortDate(r.createdAt)}</td>
              <td className="px-4 py-3 font-mono text-[11px] text-admin-muted">
                {r.lastSeenAt ? shortDate(r.lastSeenAt) : 'inconnue'}
              </td>
              <td className="px-4 py-3 text-[12px] text-admin-muted">
                {r.platform ? `${r.platform === 'ios' ? 'iOS' : 'Android'} · ${r.appVersion ?? '?'}` : 'inconnu'}
              </td>
              <td className="px-4 py-3 text-right">
                <button type="button" className="admin-btn admin-btn-sm admin-btn-ghost" onClick={() => onEdit(r)}>
                  Modifier
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BentoCell({ row }: { row: UserListRow }) {
  if (row.slots === 0) return <span className="text-admin-muted">aucun</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span>{row.slots} / 6</span>
      {row.publishedAt ? (
        <span className="admin-badge admin-badge-success">publié</span>
      ) : (
        <span className="admin-badge admin-badge-muted">brouillon</span>
      )}
      {row.isFeatured ? <span className="admin-badge admin-badge-live">coup de cœur</span> : null}
    </span>
  );
}

/**
 * Les installations qui n'ont jamais choisi de pseudo.
 *
 * On n'en connaît que l'identifiant et la date, et c'est justement le sujet :
 * elles représentent un tiers des installations, et personne ne les voyait.
 */
function OrphansTable({ rows }: { rows: OrphanRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="admin-card p-6 text-[14px] text-admin-muted">
        Toutes les installations ont choisi un pseudo.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="admin-card px-4 py-3 text-[12px] text-admin-muted">
        Ces comptes existent côté authentification mais n&apos;ont pas de profil : l&apos;app
        a été installée, puis quittée avant le choix du pseudo. Ils ne portent aucune
        donnée personnelle.
      </div>
      <div className="admin-card overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="border-b border-admin-border bg-admin-bg/60">
            <tr className="text-left font-mono text-[10px] uppercase tracking-[0.18em] text-admin-muted">
              <th className="px-4 py-2.5">Identifiant</th>
              <th className="px-4 py-2.5">Installé le</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-admin-border last:border-b-0">
                <td className="px-4 py-3 font-mono text-[11px] text-admin-muted">{r.id}</td>
                <td className="px-4 py-3 font-mono text-[11px] text-admin-muted">{shortDate(r.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
