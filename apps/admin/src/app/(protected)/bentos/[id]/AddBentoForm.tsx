'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addBentoToAccount } from '../actions';
import { checkSlug } from '@/lib/bento-slug';

/**
 * Ajouter un bento à ce compte, depuis la fiche d'un de ses bentos.
 *
 * C'est la porte d'entrée retenue au chantier 16 (D1) : l'app ne sait pas
 * encore créer de bento secondaire, et le back-office savait déjà créer un
 * bento éditorial. Cela suffit à vérifier le chantier de bout en bout sans
 * attendre le système d'éditions du chantier 13.
 *
 * Le nouveau bento naît **secondaire et en brouillon**. Le publier et le
 * mettre en avant sont deux autres gestes, qui ont déjà leur écran.
 *
 * La validation est refaite ici pour le retour immédiat, mais elle n'est pas
 * la garantie : la même règle vit dans l'action serveur, dans la contrainte
 * `bentos_slug_format` et dans `create_bento()`.
 */
export function AddBentoForm({ userId, pseudo }: { userId: string; pseudo: string }) {
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const verdict = slug.trim() === '' ? null : checkSlug(slug);

  const onSubmit = () => {
    if (!verdict?.ok) {
      setError(verdict?.error ?? 'Choisis une adresse.');
      return;
    }
    startTransition(async () => {
      const res = await addBentoToAccount({ userId, slug: verdict.slug });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setError(null);
      setSlug('');
      router.push(`/bentos/${res.bentoId}`);
    });
  };

  return (
    <section className="rounded-2xl border-2 border-admin-border p-4">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-admin-muted">
        Ajouter un bento à ce compte
      </h2>
      <p className="mt-2 text-[12px] text-admin-muted">
        Il naîtra en brouillon, à l&apos;adresse{' '}
        <code className="font-mono">
          /u/{pseudo}/{verdict?.ok ? verdict.slug : '<adresse>'}
        </code>
        . Le bento principal, lui, garde <code className="font-mono">/u/{pseudo}</code>.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value);
            setError(null);
          }}
          placeholder="hebdo-38"
          aria-label="Adresse du nouveau bento"
          className="rounded-lg border-2 border-admin-border bg-admin-bg px-3 py-1.5 font-mono text-[12px]"
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={pending || !verdict?.ok}
          className="rounded-lg border-2 border-bento-ink bg-bento-yellow px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-bento-ink disabled:opacity-40"
        >
          {pending ? 'Création…' : 'Créer'}
        </button>
      </div>
      {verdict && !verdict.ok && !error ? (
        <p className="mt-2 text-[12px] text-bento-red">{verdict.error}</p>
      ) : null}
      {error ? <p className="mt-2 text-[12px] text-bento-red">{error}</p> : null}
    </section>
  );
}
