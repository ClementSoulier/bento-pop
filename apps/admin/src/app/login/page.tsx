import type { Metadata } from 'next';
import Image from 'next/image';
import logo from '@bento-pop/brand/assets/logo/bento-pop.png';
import popyContent from '@bento-pop/brand/assets/mascot/popy-content.png';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = {
  title: 'Connexion',
};

type Props = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const { next, error } = await searchParams;

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Pitch side (Bento Pop yellow) */}
      <aside
        className="relative hidden flex-col justify-between overflow-hidden p-12 lg:flex"
        style={{
          background:
            'var(--bento-yellow) radial-gradient(circle at 30% 20%, rgba(255,255,255,0.5), transparent 50%), radial-gradient(circle at 80% 80%, rgba(217,119,6,0.2), transparent 50%)',
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage: 'radial-gradient(var(--bento-ink) 1.5px, transparent 1.5px)',
            backgroundSize: '28px 28px',
          }}
        />
        <Image src={logo} alt="Bento Pop" priority className="relative z-10 w-[140px]" />
        <div className="relative z-10">
          <h1 className="font-display mb-4 text-[56px] leading-[0.95]">
            Le pilote
            <br />
            de la cantine.
          </h1>
          <p className="max-w-[380px] text-[16px] leading-[1.55] text-bento-ink/80">
            Édite l&apos;agenda, lance les sondages, gère les réseaux et la team — sans toucher au code.
          </p>
        </div>
        <div className="relative z-10 font-mono text-[12px] text-bento-ink/55">
          backoffice · {new Date().getFullYear()} · v1
        </div>
        <Image
          src={popyContent}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -bottom-5 -right-8 w-[220px]"
          style={{ filter: 'drop-shadow(0 6px 0 rgba(0,0,0,0.15))', transform: 'rotate(8deg)' }}
        />
      </aside>

      {/* Form side */}
      <section className="grid place-items-center p-10">
        <div className="w-full max-w-[380px]">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.25em] text-admin-muted">
            Bento Pop · admin
          </p>
          <h2 className="font-display mb-2 text-[32px] leading-none">Connexion</h2>
          <p className="mb-8 text-[14px] text-admin-muted">
            Entre tes identifiants pour accéder au pilotage.
          </p>
          <LoginForm next={next ?? '/'} initialError={error} />
        </div>
      </section>
    </div>
  );
}
