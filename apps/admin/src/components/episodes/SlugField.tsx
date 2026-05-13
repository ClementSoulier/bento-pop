'use client';

import type { UseFormRegisterReturn } from 'react-hook-form';
import { Field } from '@/components/Modal';

/**
 * Champ slug "dumb" : la logique d'auto-sync depuis le titre vit dans
 * le parent (chaque Editor) qui passe `registerProps`, le `currentSlug`
 * et un callback `onResync` qui resynchronise depuis le titre courant.
 */
type SlugFieldProps = {
  registerProps: UseFormRegisterReturn;
  onResync: () => void;
  error?: string;
};

export function SlugField({ registerProps, onResync, error }: SlugFieldProps) {
  return (
    <Field
      full
      label="Slug"
      hint="Auto-généré depuis le titre. Modifie pour personnaliser."
      error={error}
    >
      <div className="flex gap-2">
        <input
          className="admin-input font-mono text-[12px]"
          spellCheck={false}
          {...registerProps}
        />
        <button
          type="button"
          className="admin-btn admin-btn-sm"
          title="Resynchroniser depuis le titre"
          onClick={onResync}
        >
          ↻ Auto
        </button>
      </div>
    </Field>
  );
}
