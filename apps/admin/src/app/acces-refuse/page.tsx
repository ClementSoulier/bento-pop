import type { Metadata } from 'next';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import logo from '@bento-pop/brand/assets/logo/bento-pop.png';
import { getAccessState } from '@/lib/auth';
import { signOut } from '@/lib/auth-actions';

export const metadata: Metadata = {
  title: 'Accès refusé',
};

export const dynamic = 'force-dynamic';

/**
 * Compte connecté mais absent de `admin_users` (cf. `lib/access.ts`). Avant cette
 * page, il était renvoyé vers /login, qui le renvoyait vers / : boucle sans fin.
 */
export default async function AccessDeniedPage() {
  const state = await getAccessState();
  if (state.kind === 'anonymous') redirect('/login');
  if (state.kind === 'admin') redirect('/');

  const unverifiable = state.reason === 'unverifiable';

  return (
    <main className="grid min-h-screen place-items-center bg-admin-bg p-10">
      <div className="admin-card w-full max-w-[460px] p-8">
        <Image src={logo} alt="Bento Pop" priority className="mb-6 w-[120px]" />
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.25em] text-admin-muted">
          Bento Pop · admin
        </p>
        <h1 className="font-display mb-4 text-[32px] leading-none">Accès refusé</h1>
        {unverifiable ? (
          <p className="mb-6 text-[14px] leading-[1.55] text-admin-ink-2">
            Impossible de vérifier tes droits pour le moment : le serveur du back-office n’arrive
            pas à lire la liste des administrateurs. Réessaie dans quelques minutes, et préviens
            l’équipe technique si ça dure.
          </p>
        ) : (
          <p className="mb-6 text-[14px] leading-[1.55] text-admin-ink-2">
            Ton compte{state.email ? <> <strong className="font-semibold">{state.email}</strong></> : null}{' '}
            est bien connecté, mais il n’a pas encore accès au back-office. Demande à un
            administrateur de l’ajouter, puis recharge cette page.
          </p>
        )}
        <form action={signOut}>
          <button type="submit" className="admin-btn admin-btn-primary admin-btn-full">
            Se déconnecter
          </button>
        </form>
      </div>
    </main>
  );
}
