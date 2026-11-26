'use client';

import { useState, useTransition, type FormEvent } from 'react';
import type { NewsletterResult } from '@/lib/newsletter/form';

export type NewsletterMessageKey =
  | 'success'
  | Extract<NewsletterResult, { status: 'error' }>['reason'];

/**
 * L'envoi d'un formulaire de la newsletter : appelle l'action serveur, garde
 * son résultat, et ne vide le champ qu'en cas de succès (sur une erreur,
 * l'adresse tapée reste là pour être corrigée).
 */
export function useNewsletterForm(action: (data: FormData) => Promise<NewsletterResult>) {
  const [result, setResult] = useState<NewsletterResult | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      try {
        const next = await action(data);
        setResult(next);
        if (next.status === 'success') form.reset();
      } catch {
        // Réseau coupé, serveur redémarré : le visiteur doit le savoir.
        setResult({ status: 'error', reason: 'unavailable' });
      }
    });
  }

  const messageKey: NewsletterMessageKey | null = result
    ? result.status === 'success'
      ? 'success'
      : result.reason
    : null;

  return { onSubmit, pending, messageKey, isError: result?.status === 'error' };
}
