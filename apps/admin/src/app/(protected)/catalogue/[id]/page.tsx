import { notFound } from 'next/navigation';
import { PageShell } from '@/components/AppShell/PageShell';
import { createMobileClient } from '@/lib/supabase/mobile';
import { ItemEditClient, type ItemDetail } from './ItemEditClient';

export const dynamic = 'force-dynamic';

type Params = Promise<{ id: string }>;

export default async function ItemDetailPage({ params }: { params: Params }) {
  const { id } = await params;

  const mobile = createMobileClient();
  if (!mobile) {
    return (
      <PageShell crumbs="Catalogue · fiche" title="Item">
        <div className="admin-card p-6 text-[14px] text-admin-muted">
          Supabase mobile non configuré.
        </div>
      </PageShell>
    );
  }

  const { data: item } = await mobile
    .from('items')
    .select(
      'id, category_id, external_source, title, subtitle, year, image_url, image_credit, status, submitted_by, submitted_at, validated_by, validated_at, rejected_by, rejected_at, rejected_reason, merged_into_id, created_at',
    )
    .eq('id', id)
    .maybeSingle();
  if (!item) notFound();

  const [{ data: category }, { data: aliases }, { data: submitter }] = await Promise.all([
    mobile
      .from('bento_categories')
      .select('label_fr, key')
      .eq('id', item.category_id)
      .maybeSingle(),
    mobile
      .from('item_aliases')
      .select('id, alias')
      .eq('item_id', item.id)
      .order('alias'),
    item.submitted_by
      ? mobile
          .from('users')
          .select('pseudo')
          .eq('id', item.submitted_by)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const detail: ItemDetail = {
    id: item.id,
    title: item.title,
    subtitle: item.subtitle,
    year: item.year,
    imageUrl: item.image_url,
    imageCredit: item.image_credit,
    status: item.status,
    externalSource: item.external_source,
    categoryLabel: category?.label_fr ?? '?',
    categoryKey: category?.key ?? null,
    submittedByPseudo: submitter?.pseudo ?? null,
    submittedAt: item.submitted_at,
    validatedAt: item.validated_at,
    rejectedAt: item.rejected_at,
    rejectedReason: item.rejected_reason,
    mergedIntoId: item.merged_into_id,
    createdAt: item.created_at,
    aliases: (aliases ?? []).map((a) => ({ id: a.id, alias: a.alias })),
  };

  return (
    <PageShell
      crumbs={`Catalogue · ${detail.categoryLabel} · ${detail.status}`}
      title={detail.title}
    >
      <ItemEditClient item={detail} />
    </PageShell>
  );
}
