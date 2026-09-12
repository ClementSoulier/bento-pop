import Link from 'next/link';
import { CATEGORY_META, CATEGORY_ORDER } from '@bento-pop/supabase-mobile/bento';
import { PageShell } from '@/components/AppShell/PageShell';
import { NewEditorialClient } from './NewEditorialClient';

export const dynamic = 'force-dynamic';

/**
 * Composition d'un bento éditorial, pour un créateur rencontré hors de l'app.
 *
 * Le profil créé ici n'a **pas de compte d'authentification** : personne ne
 * peut s'y connecter, et il ne compte pas comme utilisateur. Cf.
 * `docs/UX-14-BACK-OFFICE-UTILISATEURS.md` §5.4.
 */
export default function NouveauBentoPage() {
  const categories = CATEGORY_ORDER.map((key) => ({ key, label: CATEGORY_META[key].label }));

  return (
    <PageShell
      crumbs="Mobile · Utilisateurs"
      title="Nouveau bento invité"
      actions={
        <Link href="/utilisateurs" className="admin-btn admin-btn-ghost admin-btn-sm">
          Retour
        </Link>
      }
    >
      <NewEditorialClient categories={categories} />
    </PageShell>
  );
}
