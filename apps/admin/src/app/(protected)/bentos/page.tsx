import { PageShell } from '@/components/AppShell/PageShell';
import { createMobileClient } from '@/lib/supabase/mobile';
import { BentosClient, type BentoRow } from './BentosClient';

export const dynamic = 'force-dynamic';

/**
 * Page admin pour gérer les bentos publiés sur l'app mobile.
 *
 * Source de données : projet Supabase mobile (via service-role).
 * Pas de jointure SQL avec auth.users car cross-schema sensible — on fait
 * deux queries séparées (bentos + users) et on assemble côté serveur.
 */
export default async function BentosPage() {
  const mobile = createMobileClient();
  if (!mobile) {
    return (
      <PageShell crumbs="Bentos mobile" title="Bentos">
        <div className="admin-card p-6 text-[14px] text-admin-muted">
          Le projet Supabase <strong>mobile</strong> n&apos;est pas configuré. Renseigne{' '}
          <code className="font-mono">MOBILE_SUPABASE_URL</code> et{' '}
          <code className="font-mono">MOBILE_SUPABASE_SERVICE_ROLE_KEY</code> dans{' '}
          <code className="font-mono">apps/admin/.env</code>.
        </div>
      </PageShell>
    );
  }

  // 1. Fetch bentos publiés
  const { data: bentos } = await mobile
    .from('bentos')
    .select('id, user_id, is_featured, featured_order, published_at, updated_at')
    .not('published_at', 'is', null)
    .order('is_featured', { ascending: false })
    .order('featured_order', { ascending: true, nullsFirst: false })
    .order('published_at', { ascending: false });

  const userIds = (bentos ?? []).map((b) => b.user_id);
  // 2. Fetch profils correspondants
  const { data: users } = userIds.length
    ? await mobile.from('users').select('id, pseudo, display_name').in('id', userIds)
    : { data: [] as { id: string; pseudo: string; display_name: string | null }[] };

  const usersById = new Map((users ?? []).map((u) => [u.id, u]));

  const rows: BentoRow[] = (bentos ?? []).map((b) => {
    const u = usersById.get(b.user_id);
    return {
      id: b.id,
      userId: b.user_id,
      pseudo: u?.pseudo ?? '(supprimé)',
      displayName: u?.display_name ?? null,
      isFeatured: b.is_featured,
      featuredOrder: b.featured_order,
      publishedAt: b.published_at!,
    };
  });

  const featuredCount = rows.filter((r) => r.isFeatured).length;

  return (
    <PageShell
      crumbs={`Bentos mobile · ${rows.length} publié${rows.length > 1 ? 's' : ''} · ${featuredCount} featured`}
      title="Bentos"
    >
      <BentosClient rows={rows} />
    </PageShell>
  );
}
