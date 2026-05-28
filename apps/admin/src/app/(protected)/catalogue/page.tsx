import { PageShell } from '@/components/AppShell/PageShell';
import { createMobileClient } from '@/lib/supabase/mobile';
import { CatalogueClient, type CatalogueItemRow } from './CatalogueClient';

export const dynamic = 'force-dynamic';

/**
 * File de modération du catalogue maison (items soumis par les users).
 *
 * Stratégie de tri par défaut : FIFO sur `submitted_at` ASC pour respecter
 * l'ordre d'arrivée et éviter qu'un user attende indéfiniment. Filtres
 * et regroupement par similarité viendront plus tard si besoin.
 */
export default async function CataloguePage() {
  const mobile = createMobileClient();
  if (!mobile) {
    return (
      <PageShell crumbs="Catalogue mobile" title="Catalogue">
        <div className="admin-card p-6 text-[14px] text-admin-muted">
          Supabase mobile non configuré (cf. <code>MOBILE_SUPABASE_URL</code> /
          <code>MOBILE_SUPABASE_SERVICE_ROLE_KEY</code>).
        </div>
      </PageShell>
    );
  }

  // 1. Catégories pour les labels (id → key/label)
  const { data: categories } = await mobile
    .from('bento_categories')
    .select('id, key, label_fr');
  const catById = new Map((categories ?? []).map((c) => [c.id, c]));

  // 2. Items à modérer
  const { data: pendingItems } = await mobile
    .from('items')
    .select(
      'id, title, category_id, submitted_by, submitted_at, created_at',
    )
    .eq('status', 'pending')
    .order('submitted_at', { ascending: true, nullsFirst: false })
    .limit(200);

  // 3. Items récemment traités (lecture rapide, ne sert qu'au visuel)
  const { data: handledItems } = await mobile
    .from('items')
    .select(
      'id, title, category_id, status, validated_at, validated_by, rejected_at, rejected_by, rejected_reason',
    )
    .in('status', ['validated', 'rejected'])
    .not('validated_at', 'is', null)
    .order('validated_at', { ascending: false, nullsFirst: false })
    .limit(30);

  // 4. Auteurs (par submitted_by)
  const authorIds = [
    ...new Set(
      (pendingItems ?? [])
        .map((i) => i.submitted_by)
        .filter((x): x is string => Boolean(x)),
    ),
  ];
  const { data: authors } = authorIds.length
    ? await mobile.from('users').select('id, pseudo').in('id', authorIds)
    : { data: [] as { id: string; pseudo: string }[] };
  const pseudoById = new Map((authors ?? []).map((u) => [u.id, u.pseudo]));

  const pending: CatalogueItemRow[] = (pendingItems ?? []).map((i) => ({
    id: i.id,
    title: i.title,
    categoryLabel: catById.get(i.category_id)?.label_fr ?? '?',
    categoryKey: catById.get(i.category_id)?.key ?? null,
    submittedAt: i.submitted_at ?? i.created_at,
    authorPseudo: i.submitted_by ? (pseudoById.get(i.submitted_by) ?? '(supprimé)') : null,
    status: 'pending',
  }));

  const handled: CatalogueItemRow[] = (handledItems ?? []).map((i) => ({
    id: i.id,
    title: i.title,
    categoryLabel: catById.get(i.category_id)?.label_fr ?? '?',
    categoryKey: catById.get(i.category_id)?.key ?? null,
    submittedAt: i.validated_at ?? i.rejected_at,
    authorPseudo: null,
    status: i.status as 'validated' | 'rejected',
    rejectedReason: i.rejected_reason ?? null,
  }));

  return (
    <PageShell
      crumbs={`Catalogue · ${pending.length} en attente · ${handled.length} récents`}
      title="Catalogue"
    >
      <CatalogueClient pending={pending} handled={handled} />
    </PageShell>
  );
}
