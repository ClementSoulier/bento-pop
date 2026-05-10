'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from '@/lib/clsx';
import { updateSettings } from './actions';

export type SettingsRow = {
  seasonNumber: number;
};

type Props = { settings: SettingsRow };

function formatSeasonLabel(n: number): string {
  return `Saison ${String(n).padStart(2, '0')}`;
}

export function ConfigClient({ settings }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [seasonNumber, setSeasonNumber] = useState(String(settings.seasonNumber));
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const parsed = Number.parseInt(seasonNumber, 10);
  const validNumber = Number.isFinite(parsed) && parsed >= 1 && parsed <= 99;
  const dirty = String(settings.seasonNumber) !== seasonNumber.trim();
  const previewLabel = validNumber ? formatSeasonLabel(parsed) : 'Saison ??';

  const onSave = () => {
    setError(null);
    if (!validNumber) {
      setError('Numéro de saison entre 1 et 99.');
      return;
    }
    startTransition(async () => {
      const result = await updateSettings({ seasonNumber: parsed });
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
      <section>
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-admin-muted">
          Saison en cours
        </h2>
        <div className="admin-card overflow-hidden">
          <div className="grid grid-cols-[1fr_auto] items-end gap-6 px-6 py-5">
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
                  Numéro de saison
                </span>
                <input
                  className="admin-input font-mono"
                  type="number"
                  min={1}
                  max={99}
                  value={seasonNumber}
                  onChange={(e) => setSeasonNumber(e.target.value)}
                  placeholder="2"
                />
              </label>
              <div>
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
                  Aperçu
                </span>
                <div className="grid h-[44px] place-items-start rounded-admin-input border border-admin-border bg-admin-surface-2 px-4 py-2.5">
                  <span className="font-display text-[16px] leading-none">{previewLabel}</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              className={clsx('admin-btn admin-btn-primary', !dirty && 'admin-btn-ghost')}
              disabled={!dirty || pending}
              onClick={onSave}
            >
              {pending ? 'Enregistrement…' : dirty ? 'Enregistrer' : savedAt ? 'Enregistré' : 'OK'}
            </button>
          </div>
          <div className="border-t border-admin-border bg-admin-surface-2 px-6 py-3 font-mono text-[11px] text-admin-muted">
            Affecté : <span className="text-admin-ink">eyebrow du hero</span> ·{' '}
            <span className="text-admin-ink">sticker rouge « Saison NN »</span>
          </div>
        </div>
        {error ? <p className="mt-2 text-[12px] text-bento-red">{error}</p> : null}
      </section>

      <section>
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-admin-muted">
          À venir
        </h2>
        <div className="admin-card px-6 py-5 text-[13px] text-admin-muted">
          D&apos;autres réglages globaux viendront s&apos;ajouter ici (textes intro, couleur
          d&apos;accent, badges saisonniers, etc.). Chaque nouveau réglage = une colonne
          en plus dans <span className="font-mono text-admin-ink">landing_settings</span>{' '}
          + un champ ici.
        </div>
      </section>
    </div>
  );
}
