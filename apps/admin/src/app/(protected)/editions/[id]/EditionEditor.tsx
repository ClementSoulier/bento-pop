'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BoxPreview } from '@/components/BoxPreview';
import {
  EDITION_STATUS_LABELS,
  EDITION_TITLE_MAX,
  type EditionCase,
  type EditionDetail,
  caseVerdicts,
  editionStatus,
  validateCases,
} from '@/lib/editions';
import { saveCasesAction, updateEditionAction } from '../actions';

export type TypeOption = { id: number; label: string; active: boolean };

/** Une case neuve, dans le type le plus courant. */
function caseVierge(order: number, typeId: number): EditionCase {
  return { order, prompt: '', stamp: '', gender: 'm', typeId };
}

function versChampLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function EditionEditor({
  detail,
  types,
}: {
  detail: EditionDetail;
  types: TypeOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [title, setTitle] = useState(detail.edition.title);
  const [slug, setSlug] = useState(detail.edition.slug);
  const [releasedAt, setReleasedAt] = useState(versChampLocal(detail.edition.releasedAt));
  const [cases, setCases] = useState<EditionCase[]>(
    detail.cases.length > 0
      ? detail.cases
      : [caseVierge(1, types[0]?.id ?? 1), caseVierge(2, types[0]?.id ?? 1)],
  );

  const [cadrePending, startCadre] = useTransition();
  const [casesPending, startCases] = useTransition();

  const statut = editionStatus(releasedAt ? new Date(releasedAt).toISOString() : null);
  const sortie = statut === 'sortie';

  const verdicts = useMemo(() => caseVerdicts(cases), [cases]);
  const verdictPar = useMemo(
    () => new Map(verdicts.map((v) => [v.order, v])),
    [verdicts],
  );
  const validation = useMemo(() => validateCases(cases), [cases]);

  const apercu = useMemo(
    () =>
      [...cases]
        .sort((a, b) => a.order - b.order)
        .map((c) => {
          const v = verdictPar.get(c.order);
          // Une case pas encore écrite n'est pas une case coupée : l'aperçu
          // ne la cercle pas de rouge, la validation la refuse déjà.
          return {
            prompt: c.prompt,
            stamp: c.stamp,
            fits: v ? v.fits || v.empty : false,
            tight: v?.tight ?? false,
          };
        }),
    [cases, verdictPar],
  );

  const majCase = (order: number, patch: Partial<EditionCase>) => {
    setCases((liste) => liste.map((c) => (c.order === order ? { ...c, ...patch } : c)));
  };

  const ajouter = () => {
    if (cases.length >= 6) return;
    setCases((liste) => [...liste, caseVierge(liste.length + 1, types[0]?.id ?? 1)]);
  };

  const retirer = (order: number) => {
    if (cases.length <= 2) return;
    setCases((liste) =>
      liste
        .filter((c) => c.order !== order)
        .sort((a, b) => a.order - b.order)
        .map((c, i) => ({ ...c, order: i + 1 })),
    );
  };

  const deplacer = (order: number, sens: -1 | 1) => {
    const cible = order + sens;
    if (cible < 1 || cible > cases.length) return;
    setCases((liste) =>
      liste.map((c) =>
        c.order === order ? { ...c, order: cible } : c.order === cible ? { ...c, order } : c,
      ),
    );
  };

  const enregistrerCadre = () => {
    setError(null); setMessage(null);
    startCadre(async () => {
      const res = await updateEditionAction({
        id: detail.edition.id,
        title,
        slug,
        releasedAt: releasedAt ? new Date(releasedAt).toISOString() : null,
      });
      if (!res.ok) setError(res.error);
      else { setMessage('Cadre enregistré.'); router.refresh(); }
    });
  };

  const enregistrerCases = () => {
    setError(null); setMessage(null);
    startCases(async () => {
      const res = await saveCasesAction({ id: detail.edition.id, cases });
      if (!res.ok) setError(res.error);
      else { setMessage(`${cases.length} cases enregistrées.`); router.refresh(); }
    });
  };

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <div className="admin-card border-bento-red bg-bento-red/10 px-4 py-3 text-[13px] text-bento-red">
          {error}
        </div>
      )}
      {message && (
        <div className="admin-card bg-bento-yellow/20 px-4 py-3 text-[13px]" role="status">
          {message}
        </div>
      )}

      {sortie && (
        <div className="admin-card border-admin-border bg-admin-yellow-soft px-4 py-3 text-[13px]">
          <strong>Cette édition est sortie.</strong> Ses cases ne se modifient plus : des personnes
          ont pu y poser des items, et les remplacer les effacerait. Retire sa date de sortie pour
          la masquer de tout le monde, puis modifie.
        </div>
      )}

      {/* ─── Le cadre ─────────────────────────────────────────────── */}
      <section className="admin-card p-4">
        <h2 className="mb-3 text-[13px] font-semibold">Cadre</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
              Titre
            </span>
            <input
              id="cadre-title"
              className="admin-input h-[34px] w-[280px] py-0 text-[13px]"
              value={title}
              maxLength={EDITION_TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
              Adresse
            </span>
            <input
              id="cadre-slug"
              className="admin-input h-[34px] w-[200px] py-0 font-mono text-[13px]"
              value={slug}
              maxLength={40}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
              Sortie
            </span>
            <input
              id="cadre-released"
              type="datetime-local"
              className="admin-input h-[34px] w-[210px] py-0 font-mono text-[13px]"
              value={releasedAt}
              onChange={(e) => setReleasedAt(e.target.value)}
            />
          </label>
          <span className="inline-block h-[34px] rounded-full border-2 border-bento-ink px-3 py-[7px] font-mono text-[9px] uppercase tracking-[0.12em]">
            {EDITION_STATUS_LABELS[statut]}
          </span>
          <button
            type="button"
            className="admin-btn admin-btn-primary h-[34px] py-0"
            onClick={enregistrerCadre}
            disabled={cadrePending}
          >
            {cadrePending ? 'Enregistrement…' : 'Enregistrer le cadre'}
          </button>
        </div>
        <p className="mt-3 text-[12px] text-admin-muted">
          L’adresse devient celle du bento de chaque personne qui compose l’édition :{' '}
          <code className="font-mono">/u/&lt;pseudo&gt;/{slug || '…'}</code>. Elle est partagée, donc
          elle ne se change plus une fois l’édition sortie.
        </p>
      </section>

      {/* ─── Les cases, et l'aperçu ───────────────────────────────── */}
      <div className="flex flex-wrap items-start gap-5">
        <section className="admin-card min-w-[520px] flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-3 border-b border-admin-border bg-admin-bg/60 px-4 py-3">
            <span className="text-[13px] font-semibold">
              Cases · {cases.length} sur 6
            </span>
            <span className="flex gap-2">
              <button
                type="button"
                className="admin-btn admin-btn-sm h-[28px] py-0"
                onClick={ajouter}
                disabled={cases.length >= 6 || sortie}
              >
                Ajouter
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-primary admin-btn-sm h-[28px] py-0"
                onClick={enregistrerCases}
                disabled={casesPending || sortie || !validation.ok}
              >
                {casesPending ? 'Enregistrement…' : 'Enregistrer les cases'}
              </button>
            </span>
          </header>

          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-admin-border text-left font-mono text-[10px] uppercase tracking-[0.18em] text-admin-muted">
                <th className="px-4 py-2 font-medium">Rang</th>
                <th className="px-2 py-2 font-medium">Intitulé</th>
                <th className="px-2 py-2 font-medium">Tampon</th>
                <th className="px-2 py-2 font-medium">Genre</th>
                <th className="px-2 py-2 font-medium">Type</th>
                <th className="px-4 py-2 text-right font-medium">Tient ?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {[...cases].sort((a, b) => a.order - b.order).map((c) => {
                const v = verdictPar.get(c.order);
                return (
                  <tr key={c.order} className="hover:bg-admin-bg/40">
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-1">
                        <span className="font-mono text-[12px]">{c.order}</span>
                        <button
                          type="button" aria-label={`Monter la case ${c.order}`}
                          className="admin-btn admin-btn-ghost admin-btn-sm h-[22px] px-1.5 py-0"
                          onClick={() => deplacer(c.order, -1)} disabled={c.order === 1 || sortie}
                        >↑</button>
                        <button
                          type="button" aria-label={`Descendre la case ${c.order}`}
                          className="admin-btn admin-btn-ghost admin-btn-sm h-[22px] px-1.5 py-0"
                          onClick={() => deplacer(c.order, 1)}
                          disabled={c.order === cases.length || sortie}
                        >↓</button>
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        id={`case-prompt-${c.order}`}
                        className="admin-input h-[30px] w-full py-0 text-[12px]"
                        value={c.prompt} maxLength={120} disabled={sortie}
                        placeholder="Le film qui t’a fait pleurer"
                        onChange={(e) => majCase(c.order, { prompt: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        id={`case-stamp-${c.order}`}
                        className="admin-input h-[30px] w-[80px] py-0 font-mono text-[12px] uppercase"
                        value={c.stamp} maxLength={8} disabled={sortie} placeholder="FILM"
                        onChange={(e) => majCase(c.order, { stamp: e.target.value.toUpperCase() })}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        id={`case-gender-${c.order}`}
                        className="admin-select h-[30px] w-[78px] py-0 text-[12px]"
                        value={c.gender} disabled={sortie}
                        onChange={(e) => majCase(c.order, { gender: e.target.value as 'm' | 'f' })}
                      >
                        <option value="m">un</option>
                        <option value="f">une</option>
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <select
                        id={`case-type-${c.order}`}
                        className="admin-select h-[30px] w-[130px] py-0 text-[12px]"
                        value={c.typeId} disabled={sortie}
                        onChange={(e) => majCase(c.order, { typeId: Number(e.target.value) })}
                      >
                        {types.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label}{t.active ? '' : ' (inactif)'}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right">
                      <Verdict v={v} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <footer className="border-t border-admin-border px-4 py-3 text-[12px]">
            {validation.ok ? (
              <span className="text-admin-muted">
                Les {cases.length} cases tiennent dans la disposition à {cases.length}.
              </span>
            ) : (
              <span className="text-bento-red">{validation.error}</span>
            )}
            {cases.length > 2 && (
              <button
                type="button"
                className="admin-btn admin-btn-sm ml-3 h-[24px] py-0"
                onClick={() => retirer(cases.length)} disabled={sortie}
              >
                Retirer la dernière
              </button>
            )}
          </footer>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-[13px] font-semibold">Aperçu</h2>
          <BoxPreview cases={apercu} />
          <p className="max-w-[300px] text-[12px] text-admin-muted">
            Géométrie réelle, 361 × 512, et coupe à deux lignes comme la case vide de l’app. Une
            case <span className="text-bento-red">cerclée de rouge</span> sera tronquée ;{' '}
            <span className="text-bento-orange">d’orange</span>, elle tient mais risque la coupe sur
            un petit écran.
          </p>
        </section>
      </div>
    </div>
  );
}

function Verdict({ v }: { v: ReturnType<typeof caseVerdicts>[number] | undefined }) {
  if (!v) return <span className="text-admin-muted">—</span>;
  if (v.empty) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-admin-muted">
        à écrire
      </span>
    );
  }
  const part = `${Math.round(v.ratio * 100)} %`;
  if (!v.fits) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-bento-red">
        coupé · {v.lines} lignes
      </span>
    );
  }
  if (v.tight) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-bento-orange">
        serré · {part}
      </span>
    );
  }
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-admin-muted">
      tient · {part}
    </span>
  );
}
