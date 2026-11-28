'use client';

import { useId } from 'react';
import { unsubscribeNewsletter } from '@/lib/newsletter/actions';
import { clsx } from '@/lib/clsx';
import { Honeypot } from './Honeypot';
import { useNewsletterForm, type NewsletterMessageKey } from './useNewsletterForm';

/*
 * La réponse est la même que l'adresse soit inscrite ou non : personne ne peut
 * se servir de ce formulaire pour savoir qui reçoit la newsletter.
 */
const MESSAGES: Record<NewsletterMessageKey, string> = {
  success:
    'C’est fait : si cette adresse était inscrite, elle a été effacée et ne recevra plus la newsletter.',
  invalid_email: 'Cette adresse email ne semble pas valide.',
  rate_limited: 'Trop de tentatives à la suite. Réessayez dans un quart d’heure.',
  unavailable:
    'La désinscription ne répond pas pour le moment. Réessayez plus tard, ou écrivez à contact@bento-pop.com.',
};

/** Désinscription de la newsletter, sur la politique de confidentialité. */
export function NewsletterUnsubscribe() {
  const { onSubmit, pending, messageKey, isError } = useNewsletterForm(unsubscribeNewsletter);
  const id = useId();
  const inputId = `${id}-email`;
  const statusId = `${id}-statut`;

  return (
    <form
      onSubmit={onSubmit}
      aria-busy={pending}
      className="relative my-5 rounded-[22px] border-[3px] border-bento-ink bg-bento-cream p-5 shadow-stamp"
    >
      <Honeypot />
      <label htmlFor={inputId} className="mb-2 block text-[14px] font-semibold text-bento-ink">
        Adresse email à désinscrire
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
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
          placeholder="votre.adresse@email.fr"
          readOnly={pending}
          aria-invalid={isError && messageKey === 'invalid_email' ? true : undefined}
          aria-describedby={statusId}
          className="h-[50px] min-w-0 rounded-full sm:flex-1 border-[3px] border-bento-ink bg-white px-5 text-[16px] text-bento-ink placeholder:text-bento-ink/45 focus-visible:rounded-full"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-[50px] shrink-0 rounded-full focus-visible:rounded-full border-[3px] border-bento-ink bg-bento-ink px-6 text-[14px] font-bold uppercase tracking-[0.1em] text-bento-cream transition-transform duration-100 hover:-translate-y-0.5 active:translate-y-0.5 disabled:cursor-wait disabled:opacity-70"
        >
          {pending ? 'Envoi…' : 'Me désinscrire'}
        </button>
      </div>
      <p
        id={statusId}
        role="status"
        aria-live="polite"
        className="!mb-0 mt-3 min-h-[1.5em] text-[14px] font-semibold text-bento-ink"
      >
        {messageKey ? (
          <>
            <span
              aria-hidden="true"
              className={clsx(
                'mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle',
                isError ? 'bg-bento-red' : 'bg-bento-ink',
              )}
            />
            {MESSAGES[messageKey]}
          </>
        ) : null}
      </p>
    </form>
  );
}
