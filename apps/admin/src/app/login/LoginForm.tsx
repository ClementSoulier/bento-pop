'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/browser';
import { clsx } from '@/lib/clsx';

const schema = z.object({
  email: z.string().trim().email("Adresse email invalide"),
  password: z.string().min(6, '6 caractères minimum'),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  next: string;
  initialError?: string;
};

export function LoginForm({ next, initialError }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(initialError ?? null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = (values: FormValues) => {
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword(values);
      if (signInError) {
        setError('Identifiants incorrects.');
        return;
      }
      router.replace(next);
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Field label="Email" error={errors.email?.message}>
        <input
          type="email"
          autoComplete="email"
          autoFocus
          {...register('email')}
          className="admin-input"
          placeholder="captain@bento-pop.com"
        />
      </Field>

      <Field label="Mot de passe" error={errors.password?.message}>
        <input
          type="password"
          autoComplete="current-password"
          {...register('password')}
          className="admin-input"
          placeholder="••••••••"
        />
      </Field>

      {error ? (
        <div
          role="alert"
          className="rounded-admin-input border border-admin-border bg-admin-red-soft px-3 py-2 text-[12px] text-bento-red"
        >
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className={clsx(
          'admin-btn admin-btn-primary admin-btn-full',
          pending && 'opacity-70',
        )}
      >
        {pending ? 'Connexion…' : 'Se connecter'}
      </button>

      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-admin-muted-2">
        Premier accès ? Le tout premier compte créé devient automatiquement admin.
      </p>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
        {label}
      </span>
      {children}
      {error ? <span className="mt-1 block text-[11px] text-bento-red">{error}</span> : null}
    </label>
  );
}
