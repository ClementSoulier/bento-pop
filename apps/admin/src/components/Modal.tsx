'use client';

import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { clsx } from '@/lib/clsx';

type ModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  crumbs: string;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  badge?: ReactNode;
};

export function Modal({ open, onOpenChange, crumbs, title, children, footer, badge }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="admin-modal-overlay" />
        <Dialog.Content className="admin-modal-content">
          <header className="flex items-center gap-3 border-b border-admin-border px-6 py-5">
            <div className="min-w-0">
              <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-admin-muted">
                {crumbs}
              </div>
              <Dialog.Title className="font-display truncate text-[22px] leading-none">
                {title}
              </Dialog.Title>
            </div>
            <div className="flex-1" />
            {badge}
          </header>
          <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
          {footer ? (
            <footer className="flex items-center justify-end gap-2 border-t border-admin-border bg-admin-surface-2 px-6 py-4">
              {footer}
            </footer>
          ) : null}
          <Dialog.Description className="sr-only">{crumbs}</Dialog.Description>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function FormGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('grid grid-cols-2 gap-4', className)}>{children}</div>;
}

export function Field({
  label,
  hint,
  error,
  full,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  full?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={clsx('block', full && 'col-span-2')}>
      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="mt-1.5 block font-mono text-[11px] tracking-[0.05em] text-admin-muted">
          {hint}
        </span>
      ) : null}
      {error ? <span className="mt-1 block text-[11px] text-bento-red">{error}</span> : null}
    </label>
  );
}
