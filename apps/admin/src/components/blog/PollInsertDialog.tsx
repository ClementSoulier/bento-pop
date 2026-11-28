'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { PollSnapshot } from '@/lib/blog/poll';
import { clsx } from '@/lib/clsx';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  polls: PollSnapshot[];
  onInsert: (snapshot: PollSnapshot) => void;
};

/**
 * Choix d'un sondage dont les résultats seront figés dans l'article. Les chiffres
 * sont ceux lus à l'ouverture de la page d'édition.
 */
export function PollInsertDialog({ open, onOpenChange, polls, onInsert }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const chosen = polls.find((p) => p.weekId === selected) ?? null;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) setSelected(null);
        onOpenChange(o);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="admin-modal-overlay" />
        <Dialog.Content className="admin-modal-content">
          <header className="border-b border-admin-border px-6 py-5">
            <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-admin-muted">
              Article · sondage
            </div>
            <Dialog.Title className="font-display text-[22px] leading-none">
              Insérer des résultats
            </Dialog.Title>
          </header>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {polls.length === 0 ? (
              <p className="text-[13px] text-admin-muted">Aucun sondage pour l’instant.</p>
            ) : (
              <ul className="space-y-2" role="radiogroup" aria-label="Sondages">
                {polls.map((p) => (
                  <li key={p.weekId}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={selected === p.weekId}
                      onClick={() => setSelected(p.weekId)}
                      className={clsx(
                        'w-full rounded-admin-input border px-3 py-2.5 text-left transition-colors',
                        selected === p.weekId
                          ? 'border-admin-ink bg-admin-ink text-bento-cream'
                          : 'border-admin-border bg-admin-surface-2 hover:border-admin-ink',
                      )}
                    >
                      <div className="font-mono text-[10px] uppercase tracking-[0.12em] opacity-70">
                        {p.weekTag} · {p.total} vote{p.total > 1 ? 's' : ''}
                      </div>
                      <div className="text-[13px] font-semibold">{p.question}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-[11px] text-admin-muted">
              Les chiffres sont figés dans l’article : ce sont ceux lus à l’ouverture de cette page,
              ils ne bougeront plus.
            </p>
          </div>
          <footer className="flex items-center justify-end gap-2 border-t border-admin-border bg-admin-surface-2 px-6 py-4">
            <button type="button" className="admin-btn" onClick={() => onOpenChange(false)}>
              Annuler
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              disabled={!chosen}
              onClick={() => {
                if (!chosen) return;
                onInsert(chosen);
                setSelected(null);
                onOpenChange(false);
              }}
            >
              Insérer
            </button>
          </footer>
          <Dialog.Description className="sr-only">
            Choisis un sondage du Thermomètre pour insérer ses résultats dans l’article.
          </Dialog.Description>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
