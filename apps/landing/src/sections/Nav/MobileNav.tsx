'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import type { NavCta, NavLink as NavLinkType } from '@/lib/content/schemas';
import { iconRegistry } from '@/components/icons';
import { clsx } from '@/lib/clsx';

type MobileNavProps = {
  links: NavLinkType[];
  cta: NavCta;
};

/**
 * Menu mobile (burger) — visible uniquement < md (768px).
 *
 * A11y :
 *   - `role="dialog"` + `aria-modal="true"` sur le panneau ouvert
 *   - `aria-expanded` / `aria-controls` sur le bouton burger
 *   - Échap ferme, clic backdrop ferme, clic lien ferme
 *   - Focus trap manuel (Tab cycle), focus initial sur le premier lien
 *   - Restauration du focus sur le burger à la fermeture
 *   - `body { overflow: hidden }` pendant l'ouverture pour bloquer le scroll
 *     du document derrière le panneau
 */
export function MobileNav({ links, cta }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const Icon = iconRegistry[cta.iconKey];

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus le premier élément focusable du panneau à l'ouverture.
    const firstFocusable = panelRef.current?.querySelector<HTMLElement>(
      'a, button, [tabindex]:not([tabindex="-1"])',
    );
    firstFocusable?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key !== 'Tab') return;
      // Trap : Tab / Shift+Tab boucle dans le panneau.
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'a, button, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      // Restaure le focus sur l'élément qui avait le focus avant l'ouverture
      // (le bouton burger, dans 99% des cas).
      previouslyFocused?.focus?.();
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Ouvrir le menu"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(true)}
        className="md:hidden inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[3px] border-bento-ink bg-bento-cream text-bento-ink shadow-stamp transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-stamp-lg active:translate-y-0.5 active:shadow-[0_2px_0_var(--bento-ink)]"
      >
        <BurgerIcon />
      </button>

      <div
        id={panelId}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navigation"
        hidden={!open}
        className="fixed inset-0 z-[60] md:hidden"
      >
        {/* Backdrop : clic = fermer. Décoratif visuellement, bouton invisible
            pour l'a11y mais reste utilisable au clavier via le focus trap. */}
        <button
          type="button"
          aria-label="Fermer le menu"
          tabIndex={-1}
          onClick={close}
          className="absolute inset-0 cursor-default bg-bento-ink/60"
        />

        {/* Panneau slide-in depuis la droite. */}
        <div
          className={clsx(
            'absolute right-0 top-0 flex h-full w-[88%] max-w-[360px] flex-col',
            'border-l-[5px] border-bento-ink bg-bento-yellow',
            'shadow-[-10px_0_30px_rgba(0,0,0,0.3)]',
          )}
        >
          <div className="flex items-center justify-between border-b-[4px] border-bento-ink px-6 py-4">
            <span className="font-display text-[22px] uppercase">Menu</span>
            <button
              type="button"
              aria-label="Fermer le menu"
              onClick={close}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-bento-ink bg-bento-cream text-bento-ink shadow-stamp transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-stamp-lg active:translate-y-0.5 active:shadow-[0_2px_0_var(--bento-ink)]"
            >
              <CloseIcon />
            </button>
          </div>

          <nav
            aria-label="Menu mobile"
            className="flex flex-1 flex-col gap-2 px-6 py-7"
          >
            {links.map((l) => (
              <Link
                key={l.id}
                href={l.href}
                onClick={close}
                className="block rounded-2xl border-[3px] border-transparent px-4 py-3 text-[15px] font-bold uppercase tracking-[0.1em] text-bento-ink transition-[transform,background,border-color] hover:-translate-y-0.5 hover:border-bento-ink hover:bg-bento-cream"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="border-t-[4px] border-bento-ink p-6">
            <a
              href={cta.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={close}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border-[3px] border-bento-ink bg-bento-red px-5 pt-3 pb-2.5 font-bold uppercase tracking-[0.08em] text-[14px] text-bento-cream shadow-stamp transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-stamp-lg active:translate-y-0.5 active:shadow-[0_2px_0_var(--bento-ink)]"
            >
              <Icon width={18} height={18} aria-hidden />
              {cta.label}
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

function BurgerIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 6h18M3 12h18M3 18h18"
        stroke="currentColor"
        strokeWidth="2.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
