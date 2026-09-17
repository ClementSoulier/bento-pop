import Link from 'next/link';
import { PageShell } from '@/components/AppShell/PageShell';
import { loadDuplicateGroups, readAll, STATUS_LABELS, type ItemStatus } from '@/lib/catalogue-types';
import { createMobileClient } from '@/lib/supabase/mobile';
import {
  CatalogueClient,
  type CatalogueFullRow,
  type CatalogueItemRow,
  type DuplicateGroupView,
  type TypeOption,
} from './CatalogueClient';

type SearchParams = Promise<{ type?: string; statut?: string }>;

export const dynamic = 'force-dynamic';

/**
 * Catalogue maison, rangé par **type** depuis le chantier 15. Trois blocs :
 *  - « À modérer » : file FIFO (`submitted_at` ASC) des propositions users,
 *    avec les actions valider / refuser / fusionner / image.
 *  - « Doublons probables » : items d'un même type au même titre, par exemple
 *    une Personne proposée jadis comme artiste et comme créateur.
 *  - « Tout le catalogue » : tableau filtrable (type + statut) de TOUS les
 *    items, avec la validation des brouillons par lot. `?type=book&statut=draft`
 *    l'ouvre filtré, depuis les listes de départ de l'écran Types.
 */
export default async function CataloguePage({ searchParams }: { searchParams: SearchParams }) {
  const { type: typeParam, statut: statusParam } = await searchParams;
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

  // 1. Types pour les libellés et les filtres, actifs ou non : on amorce un
  //    type avant de l'activer.
  const { data: typeRows } = await mobile
    .from('item_types')
    .select('id, key, label_fr, is_active, display_order')
    .order('display_order');
  const typeById = new Map((typeRows ?? []).map((t) => [t.id, t]));
  const types: TypeOption[] = (typeRows ?? []).map((t) => ({
    id: t.id,
    key: t.key,
    label: t.label_fr,
    active: t.is_active,
  }));

  // 2. Items à modérer
  const { data: pendingItems } = await mobile
    .from('items')
    .select(
      'id, title, type_id, submitted_by, submitted_at, created_at',
    )
    .eq('status', 'pending')
    .order('submitted_at', { ascending: true, nullsFirst: false })
    .limit(200);

  // 3. TOUT le catalogue (vue d'ensemble filtrable). On récupère tous les
  //    items quel que soit le statut, y compris les validés historiques ou
  //    importés qui n'ont pas de `validated_at`. Par pages : Supabase coupe
  //    une réponse à 1 000 lignes sans le dire, et les listes de départ
  //    approchent le catalogue de ce seuil.
  const allItemsRaw = await readAll((from, to) =>
    mobile
      .from('items')
      .select('id, title, subtitle, year, image_url, type_id, status, created_at')
      .order('created_at', { ascending: false })
      .order('id')
      .range(from, to),
  );

  // 3b. Nombre de bentos contenant chaque item (toutes publications confondues).
  //     On agrège côté serveur : une ligne bento_items = un item dans un bento.
  const allBentoItems = await readAll((from, to) =>
    mobile
      .from('bento_items')
      .select('item_id')
      .order('bento_id')
      .order('category_id')
      .range(from, to),
  );
  const bentoCountByItem = new Map<string, number>();
  allBentoItems.forEach((bi) => {
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
    typeLabel: typeById.get(i.type_id)?.label_fr ?? '?',
    typeKey: typeById.get(i.type_id)?.key ?? null,
    submittedAt: i.submitted_at ?? i.created_at,
    // L'auteur est le compte, pas le profil (chantier 17, D13) : on propose
    // avant sa première publication, donc avant d'avoir un pseudo. Un profil
    // supprimé, lui, retire l'auteur (`users_forget_author`).
    author: i.submitted_by ? { pseudo: pseudoById.get(i.submitted_by) ?? null } : null,
    status: 'pending',
  }));

  const allItems: CatalogueFullRow[] = allItemsRaw.map((i) => ({
    id: i.id,
    title: i.title,
    subtitle: i.subtitle ?? null,
    year: i.year ?? null,
    hasImage: Boolean(i.image_url),
    typeLabel: typeById.get(i.type_id)?.label_fr ?? '?',
    typeKey: typeById.get(i.type_id)?.key ?? null,
    status: i.status as CatalogueFullRow['status'],
    bentoCount: bentoCountByItem.get(i.id) ?? 0,
  }));

  // 4b. Doublons probables : même type, même titre une fois normalisé.
  const duplicates: DuplicateGroupView[] = (await loadDuplicateGroups(mobile)).map((g) => ({
    typeLabel: typeById.get(g.typeId)?.label_fr ?? '?',
    items: g.items.map((i) => ({
      id: i.id,
      title: i.title,
      status: i.status,
      bentoCount: i.bentoCount,
      hasImage: i.hasImage,
    })),
  }));

  // 5. Illustrations proposées par le script `catalog-images` et pas encore
  //    tranchées : on affiche l'entrée seulement s'il y a du travail.
  const { count: suggestionCount } = await mobile
    .from('item_image_suggestions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  return (
    <PageShell
      crumbs={`Catalogue · ${pending.length} en attente · ${allItems.length} items`}
      title="Catalogue"
    >
      {suggestionCount ? (
        <Link
          href="/catalogue/illustrations"
          className="admin-card mb-4 flex items-center justify-between gap-3 px-4 py-3 text-[13px] hover:bg-admin-bg/60"
        >
          <span>
            <strong>{suggestionCount}</strong> proposition
            {suggestionCount > 1 ? 's' : ''} d&apos;illustration à trancher
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-admin-muted">
            Ouvrir →
          </span>
        </Link>
      ) : null}
      <CatalogueClient
        pending={pending}
        allItems={allItems}
        types={types}
        duplicates={duplicates}
        initialTypeFilter={types.some((t) => t.key === typeParam) ? (typeParam ?? 'all') : 'all'}
        initialStatusFilter={
          statusParam && statusParam in STATUS_LABELS ? (statusParam as ItemStatus) : 'all'
        }
      />
    </PageShell>
  );
}
