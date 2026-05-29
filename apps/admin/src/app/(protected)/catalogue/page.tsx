import { PageShell } from '@/components/AppShell/PageShell';
import { createMobileClient } from '@/lib/supabase/mobile';
import {
  CatalogueClient,
  type CatalogueFullRow,
  type CatalogueItemRow,
} from './CatalogueClient';

export const dynamic = 'force-dynamic';

/**
 * Catalogue maison. Deux blocs :
 *  - « À modérer » : file FIFO (`submitted_at` ASC) des propositions users,
 *    avec les actions valider / refuser / fusionner / image.
 *  - « Tout le catalogue » : tableau filtrable (type + statut) de TOUS les
 *    items, y compris les validés historiques / importés sans `validated_at`
 *    qui n'apparaissaient nulle part avant.
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

  // 3. TOUT le catalogue (vue d'ensemble filtrable). On récupère tous les
  //    items quel que soit le statut — y compris les validés historiques /
  //    importés qui n'ont pas de `validated_at` et n'apparaissaient donc
  //    nulle part dans l'ancienne vue « récemment traités ».
  const { data: allItemsRaw } = await mobile
    .from('items')
    .select('id, title, subtitle, year, image_url, category_id, status, created_at')
    .order('created_at', { ascending: false, nullsFirst: false })
    .limit(2000);

  // 3b. Nombre de bentos contenant chaque item (toutes publications confondues).
  //     On agrège côté serveur : une ligne bento_items = un item dans un bento.
  const { data: allBentoItems } = await mobile.from('bento_items').select('item_id');
  const bentoCountByItem = new Map<string, number>();
  (allBentoItems ?? []).forEach((bi) => {
    bentoCountByItem.set(bi.item_id, (bentoCountByItem.get(bi.item_id) ?? 0) + 1);
  });

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

  const allItems: CatalogueFullRow[] = (allItemsRaw ?? []).map((i) => ({
    id: i.id,
    title: i.title,
    subtitle: i.subtitle ?? null,
    year: i.year ?? null,
    hasImage: Boolean(i.image_url),
    categoryLabel: catById.get(i.category_id)?.label_fr ?? '?',
    categoryKey: catById.get(i.category_id)?.key ?? null,
    status: i.status as CatalogueFullRow['status'],
    bentoCount: bentoCountByItem.get(i.id) ?? 0,
  }));

  return (
    <PageShell
      crumbs={`Catalogue · ${pending.length} en attente · ${allItems.length} items`}
      title="Catalogue"
    >
      <CatalogueClient pending={pending} allItems={allItems} />
    </PageShell>
  );
}
