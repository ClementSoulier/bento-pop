'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from '@/lib/clsx';
import { updateMobileConfig } from './actions';

export type MobileConfigRow = {
  maintenanceMode: boolean;
  maintenanceTitle: string;
  maintenanceMessage: string;
  iosMinVersion: string;
  iosLatestVersion: string;
  androidMinVersion: string | null;
  androidLatestVersion: string | null;
};

type Props = { config: MobileConfigRow };

export function MobileConfigClient({ config }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<MobileConfigRow>(config);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const dirty = JSON.stringify(form) !== JSON.stringify(config);

  const onSave = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateMobileConfig({
        maintenanceMode: form.maintenanceMode,
        maintenanceTitle: form.maintenanceTitle,
        maintenanceMessage: form.maintenanceMessage,
        iosMinVersion: form.iosMinVersion,
        iosLatestVersion: form.iosLatestVersion,
        androidMinVersion: form.androidMinVersion ?? '',
        androidLatestVersion: form.androidLatestVersion ?? '',
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSavedAt(Date.now());
      router.refresh();
    });
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      {form.maintenanceMode ? (
        <div className="admin-card border-bento-red bg-[#fff4f4] p-4 text-[13px] text-bento-red">
          <strong className="font-mono uppercase tracking-[0.12em]">Attention</strong>{' '}
          — l&apos;app mobile est actuellement en <strong>mode maintenance</strong>. Tous
          les utilisateurs voient un écran bloquant au boot.
        </div>
      ) : null}

      <section>
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-admin-muted">
          Mode maintenance
        </h2>
        <div className="admin-card overflow-hidden">
          <div className="grid grid-cols-1 gap-4 px-6 py-5">
            <label className="flex items-center gap-3 text-[14px]">
              <input
                type="checkbox"
                className="h-4 w-4 accent-bento-red"
                checked={form.maintenanceMode}
                onChange={(e) =>
                  setForm((f) => ({ ...f, maintenanceMode: e.target.checked }))
                }
              />
              Activer le mode maintenance (bloque l&apos;app pour tous les users)
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
                Titre affiché
              </span>
              <input
                className="admin-input"
                type="text"
                value={form.maintenanceTitle}
                onChange={(e) =>
                  setForm((f) => ({ ...f, maintenanceTitle: e.target.value }))
                }
                placeholder="On revient vite"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
                Message
              </span>
              <textarea
                className="admin-input min-h-[80px]"
                value={form.maintenanceMessage}
                onChange={(e) =>
                  setForm((f) => ({ ...f, maintenanceMessage: e.target.value }))
                }
                placeholder="Mon Bento Pop est en maintenance, on revient dans quelques minutes."
              />
            </label>
          </div>
          <div className="border-t border-admin-border bg-admin-surface-2 px-6 py-3 font-mono text-[11px] text-admin-muted">
            Penser à <strong>désactiver</strong> avant toute soumission Apple : le
            reviewer voit l&apos;écran maintenance et rejette.
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-admin-muted">
          Versions supportées
        </h2>
        <div className="admin-card overflow-hidden">
          <div className="grid grid-cols-2 gap-4 px-6 py-5">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
                iOS — version minimum
              </span>
              <input
                className="admin-input font-mono"
                type="text"
                value={form.iosMinVersion}
                onChange={(e) =>
                  setForm((f) => ({ ...f, iosMinVersion: e.target.value }))
                }
                placeholder="1.0.0"
              />
              <span className="mt-1 block text-[11px] text-admin-muted">
                Les users sous cette version voient un écran &quot;mettre à jour&quot;.
              </span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
                iOS — dernière version dispo
              </span>
              <input
                className="admin-input font-mono"
                type="text"
                value={form.iosLatestVersion}
                onChange={(e) =>
                  setForm((f) => ({ ...f, iosLatestVersion: e.target.value }))
                }
                placeholder="1.0.0"
              />
              <span className="mt-1 block text-[11px] text-admin-muted">
                Informatif (V2 : soft-prompt &quot;mise à jour dispo&quot;).
              </span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
                Android — version minimum
              </span>
              <input
                className="admin-input font-mono"
                type="text"
                value={form.androidMinVersion ?? ''}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    androidMinVersion: e.target.value || null,
                  }))
                }
                placeholder="(pas en prod)"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
                Android — dernière version dispo
              </span>
              <input
                className="admin-input font-mono"
                type="text"
                value={form.androidLatestVersion ?? ''}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    androidLatestVersion: e.target.value || null,
                  }))
                }
                placeholder="(pas en prod)"
              />
            </label>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-end gap-3">
        {error ? <p className="text-[12px] text-bento-red">{error}</p> : null}
        <button
          type="button"
          className={clsx('admin-btn admin-btn-primary', !dirty && 'admin-btn-ghost')}
          disabled={!dirty || pending}
          onClick={onSave}
        >
          {pending ? 'Enregistrement…' : dirty ? 'Enregistrer' : savedAt ? 'Enregistré' : 'OK'}
        </button>
      </div>
    </div>
  );
}
