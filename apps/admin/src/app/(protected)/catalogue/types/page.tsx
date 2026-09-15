import Link from 'next/link';
import { PageShell } from '@/components/AppShell/PageShell';
import { loadItemTypes } from '@/lib/catalogue-types';
import { createMobileClient } from '@/lib/supabase/mobile';
import { TypesClient } from './TypesClient';

export const dynamic = 'force-dynamic';

/**
 * Les types d'éléments du catalogue mobile : ce qu'est un item, et donc où on
 * le cherche. Distincts des cases qui les accueillent : Artiste et Créateur
 * de contenu sont deux cases de type Personne.
 *
 * Cf. `docs/UX-15-NOUVELLES-CATEGORIES.md`.
 */
export default async function TypesPage() {
  const mobile = createMobileClient();
  if (!mobile) {
    return (
      <PageShell crumbs="Catalogue · types" title="Types">
        <div className="admin-card p-6 text-[14px] text-admin-muted">
          Supabase mobile non configuré (cf. <code>MOBILE_SUPABASE_URL</code> /
          <code>MOBILE_SUPABASE_SERVICE_ROLE_KEY</code>).
        </div>
      </PageShell>
    );
  }

  const types = await loadItemTypes(mobile);
  const active = types.filter((t) => t.active).length;

  return (
    <PageShell
      crumbs={`Catalogue · ${types.length} types · ${active} actifs`}
      title="Types"
      actions={
        <Link href="/catalogue" className="admin-btn admin-btn-sm">
          ← Catalogue
        </Link>
      }
    >
      <TypesClient types={types} />
    </PageShell>
  );
}
