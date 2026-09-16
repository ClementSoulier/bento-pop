'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { publicBentoUrl } from '@/lib/bento-url';
import { checkPseudoShape } from '@/lib/pseudo-rules';
import { DELETION_REASONS, type DeletionReasonId } from '@/lib/deletion-reasons';
import { deleteMobileUser, deleteOrphanAccounts, updateMobileUser } from './actions';
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
  const [deleting, setDeleting] = useState<UserListRow | null>(null);
  const [orphanRows, setOrphanRows] = useState(orphans);

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
        // Aucun bento du tout, et non « le principal est vide » : les deux
        // coïncidaient tant qu'un compte n'en avait qu'un.
        return searched.filter((r) => r.bentoCount === 0);
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
        <Tabs tab={tab} setTab={setTab} profils={rows.length} orphelins={orphanRows.length} />
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

          <ProfilesTable rows={visible} onEdit={setEditing} onDelete={setDeleting} />
        </>
      ) : (
        <OrphansTable rows={orphanRows} onPurged={(ids) => setOrphanRows((p) => p.filter((o) => !ids.includes(o.id)))} />
      )}

      {deleting ? (
        <DeleteDialog
          row={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setRows((prev) => prev.filter((r) => r.id !== deleting.id));
            setDeleting(null);
          }}
        />
      ) : null}

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
  onDelete,
}: {
  rows: UserListRow[];
  onEdit: (row: UserListRow) => void;
  onDelete: (row: UserListRow) => void;
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
                    href={publicBentoUrl(r.pseudo)}
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
                <span className="inline-flex gap-2">
                  <button type="button" className="admin-btn admin-btn-sm admin-btn-ghost" onClick={() => onEdit(r)}>
                    Modifier
                  </button>
                  <button type="button" className="admin-btn admin-btn-sm admin-btn-danger" onClick={() => onDelete(r)}>
                    Supprimer
                  </button>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BentoCell({ row }: { row: UserListRow }) {
  if (row.bentoCount === 0) return <span className="text-admin-muted">aucun</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span>{row.slots} / 6</span>
      {/* Le compte en a-t-il d'autres ? Sans cette pastille, la cellule
          décrirait le seul bento principal et laisserait croire que c'est
          tout ce qu'il possède. Chantier 16. */}
      {row.bentoCount > 1 ? (
        <span className="admin-badge admin-badge-muted">+{row.bentoCount - 1}</span>
      ) : null}
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
function OrphansTable({
  rows,
  onPurged,
}: {
  rows: OrphanRow[];
  onPurged: (ids: string[]) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const purge = () => {
    setError(null);
    const ids = rows.map((r) => r.id);
    startTransition(async () => {
      const res = await deleteOrphanAccounts({ ids });
      if (res.ok) {
        onPurged(ids);
        setConfirming(false);
      } else {
        setError(res.error);
      }
    });
  };

  if (rows.length === 0) {
    return (
      <div className="admin-card p-6 text-[14px] text-admin-muted">
        Toutes les installations ont choisi un pseudo.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="admin-card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="max-w-3xl space-y-2 text-[12px] text-admin-muted">
          <p>
            Ces comptes existent côté authentification mais n&apos;ont pas de profil :
            l&apos;app a été installée, puis quittée avant le choix du pseudo. Ils ne
            portent aucune donnée personnelle, et leur suppression n&apos;est donc pas
            inscrite au registre.
          </p>
          {/* Le point qui n'est pas évident et qu'il faut dire avant le clic :
              ces lignes SONT le compteur d'installations. Les supprimer pour
              « faire propre » efface la seule trace de ce que l'onboarding
              perd, et l'entonnoir tomberait à 100 % de conversion. */}
          <p className="text-bento-red">
            À supprimer seulement s&apos;il s&apos;agit vraiment d&apos;essais. Ces lignes
            sont ce qui fait le compteur d&apos;installations : les effacer ferait
            passer l&apos;entonnoir à 100 % de pseudos choisis, et la perte réelle à
            l&apos;inscription deviendrait invisible.
          </p>
        </div>
        {confirming ? (
          <span className="flex items-center gap-2">
            <span className="text-[12px]">Supprimer les {rows.length} ?</span>
            <button type="button" className="admin-btn admin-btn-sm admin-btn-ghost" onClick={() => setConfirming(false)} disabled={pending}>
              Non
            </button>
            <button type="button" className="admin-btn admin-btn-sm admin-btn-danger" onClick={purge} disabled={pending}>
              {pending ? 'Suppression…' : 'Oui, supprimer'}
            </button>
          </span>
        ) : (
          <button type="button" className="admin-btn admin-btn-sm admin-btn-danger" onClick={() => setConfirming(true)}>
            Supprimer les {rows.length} comptes
          </button>
        )}
      </div>
      {error ? (
        <div className="admin-card border-bento-red px-4 py-3 text-[12px] text-bento-red">{error}</div>
      ) : null}
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

/**
 * Suppression d'un compte.
 *
 * Irréversible et sans corbeille, donc la boîte **récapitule ce qui
 * disparaît** plutôt que de demander une confirmation vague. Le motif est
 * obligatoire : c'est la trace RGPD, écrite dans la même transaction que la
 * suppression.
 */
function DeleteDialog({
  row,
  onClose,
  onDeleted,
}: {
  row: UserListRow;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [reasonId, setReasonId] = useState<DeletionReasonId>('test');
  const [detail, setDetail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const detailRequired = reasonId === 'autre';
  const blocked = detailRequired && detail.trim().length === 0;

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await deleteMobileUser({
        userId: row.id,
        reasonId,
        detail,
        hasAuthAccount: row.hasAuthAccount,
      });
      if (res.ok) onDeleted();
      else setError(res.error);
    });
  };

  return (
    <div className="admin-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="admin-modal-content max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Supprimer @${row.pseudo}`}
      >
        <h2 className="text-[16px] font-semibold text-bento-red">Supprimer @{row.pseudo}</h2>

        <ul className="mt-4 space-y-1 text-[13px] text-admin-muted">
          <li>· Le profil et son historique disparaissent.</li>
          <li>
            ·{' '}
            {/* La cascade efface TOUS ses bentos. L'ancienne formulation n'en
                décrivait qu'un : une confirmation d'action irréversible qui
                sous-déclare ce qu'elle détruit. Chantier 16. */}
            {row.bentoCount === 0
              ? 'Aucun bento à supprimer.'
              : row.bentoCount === 1
                ? `Son bento (${row.slots} case${row.slots > 1 ? 's' : ''}${row.publishedAt ? ', publié' : ', brouillon'}) est supprimé.`
                : `Ses ${row.bentoCount} bentos sont supprimés, dont ${row.publishedCount} en ligne.`}
          </li>
          <li>
            · <code className="font-mono">/u/{row.pseudo}</code> renverra une page introuvable.
          </li>
          <li>
            ·{' '}
            {row.hasAuthAccount
              ? "Le compte d'authentification est supprimé également."
              : "Ce profil n'a pas de compte d'authentification."}
          </li>
          <li>· Ses signalements éventuels sont conservés, ils concernent d&apos;autres personnes.</li>
        </ul>

        <label className="mt-5 block text-[12px] font-medium">
          Motif
          <select
            className="admin-select mt-1 w-full"
            value={reasonId}
            onChange={(e) => setReasonId(e.target.value as DeletionReasonId)}
          >
            {DELETION_REASONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-3 block text-[12px] font-medium">
          Précision {detailRequired ? '(obligatoire)' : '(facultative)'}
          <input
            className="admin-input mt-1 w-full"
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder={detailRequired ? 'Explique le motif' : ''}
          />
        </label>
        <p className="mt-1 text-[11px] text-admin-muted">
          Enregistré au registre pendant 12 mois, sans le pseudo ni le nom.
        </p>

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
            className="admin-btn admin-btn-danger"
            onClick={submit}
            disabled={pending || blocked}
          >
            {pending ? 'Suppression…' : 'Supprimer définitivement'}
          </button>
        </div>
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
