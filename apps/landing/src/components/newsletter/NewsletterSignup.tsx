'use client';

import Link from 'next/link';
import { useId } from 'react';
import { subscribeNewsletter } from '@/lib/newsletter/actions';
import type { NewsletterSource } from '@/lib/newsletter/form';
import { clsx } from '@/lib/clsx';
import { Honeypot } from './Honeypot';
import { useNewsletterForm, type NewsletterMessageKey } from './useNewsletterForm';

const MESSAGES: Record<NewsletterMessageKey, string> = {
  success: 'C’est noté ! La prochaine newsletter arrivera à cette adresse.',
  invalid_email: 'Cette adresse email ne semble pas valide.',
  rate_limited: 'Trop de tentatives à la suite. Réessaie dans un quart d’heure.',
  unavailable: 'L’inscription ne répond pas pour le moment. Réessaie un peu plus tard.',
};

type Props = {
  source: NewsletterSource;
  /** `section` : le grand formulaire de l'accueil, sur fond crème. `footer` : le champ compact du pied de page, sur fond noir. */
  variant: 'section' | 'footer';
};

/**
 * Inscription à la newsletter (docs/NEWSLETTER.md) : une adresse email, rien
 * d'autre. La désinscription se fait sur /confidentialite#newsletter.
 */
export function NewsletterSignup({ source, variant }: Props) {
  const { onSubmit, pending, messageKey, isError } = useNewsletterForm(subscribeNewsletter);
  const id = useId();
  const inputId = `${id}-email`;
  const statusId = `${id}-statut`;
  const noteId = `${id}-note`;
  const isSection = variant === 'section';

  return (
    <form
      onSubmit={onSubmit}
      aria-busy={pending}
      className={clsx('relative', isSection ? 'mx-auto max-w-[640px]' : 'max-w-[460px]')}
    >
      <Honeypot />
      <input type="hidden" name="source" value={source} />
      <label
        htmlFor={inputId}
        className={
          isSection
            ? 'sr-only'
            : 'mb-2 block text-[11px] font-bold uppercase tracking-[0.25em] text-bento-yellow'
        }
      >
        {isSection ? 'Ton adresse email' : 'La newsletter'}
      </label>
      <div className={clsx('flex flex-col gap-3', isSection ? 'sm:flex-row sm:gap-4' : 'sm:flex-row')}>
        <input
          id={inputId}
          type="email"
          name="email"
          required
          maxLength={254}
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="ton.adresse@email.fr"
          readOnly={pending}
          aria-invalid={isError && messageKey === 'invalid_email' ? true : undefined}
          aria-describedby={`${statusId} ${noteId}`}
          className={clsx(
            // `focus-visible:rounded-full` : la règle de focus globale (globals.css)
            // arrondit à 4 px, ce qui rendait la pilule rectangulaire au clic.
            'min-w-0 rounded-full border-[3px] sm:flex-1 text-bento-ink placeholder:text-bento-ink/45 focus-visible:rounded-full',
            isSection
              ? 'h-[60px] border-bento-ink bg-white px-6 text-[17px] shadow-stamp'
              : 'h-[48px] border-bento-cream bg-bento-cream px-5 text-[15px]',
          )}
        />
        <button
          type="submit"
          disabled={pending}
          className={clsx(
            'shrink-0 rounded-full border-[3px] font-bold uppercase tracking-[0.1em] focus-visible:rounded-full',
            'transition-[transform,box-shadow] duration-100 ease-out disabled:cursor-wait disabled:opacity-70',
            isSection
              ? 'h-[60px] border-bento-ink bg-bento-red px-7 text-[15px] text-bento-cream shadow-stamp hover:-translate-y-0.5 hover:shadow-stamp-lg active:translate-y-0.5 active:shadow-[0_3px_0_var(--bento-ink)]'
              : 'h-[48px] border-bento-yellow bg-bento-yellow px-5 text-[13px] text-bento-ink hover:-translate-y-0.5 active:translate-y-0.5',
          )}
        >
          {pending ? 'Envoi…' : 'Je m’inscris'}
        </button>
      </div>

      <p
        id={statusId}
        role="status"
        aria-live="polite"
        className={clsx(
          'min-h-[1.5em] font-semibold',
          isSection ? 'mt-4 text-center text-[15px] text-bento-ink' : 'mt-2.5 text-[13px]',
          !isSection && (isError ? 'text-bento-red' : 'text-bento-yellow'),
        )}
      >
        {messageKey ? (
          <>
            {isSection ? (
              <span
                aria-hidden="true"
                className={clsx(
                  'mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle',
                  isError ? 'bg-bento-red' : 'bg-bento-ink',
                )}
              />
            ) : null}
            {MESSAGES[messageKey]}
          </>
        ) : null}
      </p>

      <p
        id={noteId}
        className={clsx(
          'text-pretty',
          isSection
            ? 'mx-auto mt-1 max-w-[520px] text-center text-[13px] leading-[1.5] text-bento-ink/65'
            : 'mt-1 text-[12px] leading-[1.5] text-bento-cream/55',
        )}
      >
        Ton adresse ne sert qu’à t’envoyer la newsletter. Désinscription à tout moment sur la page{' '}
        <Link href="/confidentialite#newsletter" className="underline underline-offset-[3px]">
          Confidentialité
        </Link>
        .
      </p>
    </form>
  );
}
