import { PageShell } from '@/components/AppShell/PageShell';
import { listEditions } from '@/lib/editions';
import { createMobileClient } from '@/lib/supabase/mobile';
import { EditionsClient } from './EditionsClient';

export const dynamic = 'force-dynamic';

/**
 * Les éditions hebdomadaires.
 *
 * Une édition est un modèle de bento : un titre, une adresse, une date de
 * sortie et de deux à six cases décrites. Elle sort à sa date sans nouvelle
 * version de l'app, parce que la visibilité est un filtre de lecture et non
 * un ordonnanceur. Cf. `docs/UX-13-BENTO-HEBDOMADAIRE.md`.
 */
export default async function EditionsPage() {
  const mobile = createMobileClient();
  if (!mobile) {
    return (
      <PageShell crumbs="Éditions" title="Éditions">
        <div className="admin-card p-6 text-[14px] text-admin-muted">
          Supabase mobile non configuré : renseigne <code>NEXT_PUBLIC_MOBILE_SUPABASE_URL</code> et{' '}
          <code>MOBILE_SUPABASE_SERVICE_ROLE_KEY</code>.
        </div>
      </PageShell>
    );
  }

  const res = await listEditions(mobile);
  if (!res.ok) {
    return (
      <PageShell crumbs="Éditions" title="Éditions">
        <div className="admin-card border-bento-red bg-bento-red/10 p-6 text-[14px] text-bento-red">
          {res.error}
        </div>
      </PageShell>
    );
  }

  const editions = res.value;
  const sorties = editions.filter((e) => e.status === 'sortie').length;
  const programmees = editions.filter((e) => e.status === 'programmee').length;

  return (
    <PageShell
      crumbs={`${editions.length} éditions · ${sorties} sorties · ${programmees} programmées`}
      title="Éditions"
    >
      <EditionsClient editions={editions} />
    </PageShell>
  );
}
