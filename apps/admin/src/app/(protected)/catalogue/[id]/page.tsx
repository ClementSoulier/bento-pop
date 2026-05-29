import { notFound } from 'next/navigation';
import Link from 'next/link';
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

  // Bentos contenant cet item (toutes publications confondues). Audit admin
  // via service-role : pas de filtre published_at. Trois requêtes séparées
  // (bento_items → bentos → users), cohérent avec le reste du BO qui évite
  // les jointures cross-schema.
  const { data: usageRows } = await mobile
    .from('bento_items')
    .select('bento_id')
    .eq('item_id', id);
  const usageBentoIds = [...new Set((usageRows ?? []).map((r) => r.bento_id))];
  const { data: usageBentos } = usageBentoIds.length
    ? await mobile.from('bentos').select('id, user_id, published_at').in('id', usageBentoIds)
    : { data: [] as { id: string; user_id: string; published_at: string | null }[] };
  const usageUserIds = [...new Set((usageBentos ?? []).map((b) => b.user_id))];
  const { data: usageUsers } = usageUserIds.length
    ? await mobile.from('users').select('id, pseudo').in('id', usageUserIds)
    : { data: [] as { id: string; pseudo: string }[] };
  const usagePseudoById = new Map((usageUsers ?? []).map((u) => [u.id, u.pseudo]));
  const usage: BentoUsage[] = (usageBentos ?? [])
    .map((b) => ({
      bentoId: b.id,
      pseudo: usagePseudoById.get(b.user_id) ?? '(supprimé)',
      published: Boolean(b.published_at),
    }))
    .sort((a, b) => a.pseudo.localeCompare(b.pseudo, 'fr'));

  return (
    <PageShell
      crumbs={`Catalogue · ${detail.categoryLabel} · ${detail.status}`}
      title={detail.title}
    >
      <ItemEditClient item={detail} />
      <BentoUsageCard usage={usage} />
    </PageShell>
  );
}

type BentoUsage = { bentoId: string; pseudo: string; published: boolean };

/** Liste des bentos où l'item apparaît, avec lien vers la vue admin du bento. */
function BentoUsageCard({ usage }: { usage: BentoUsage[] }) {
  return (
    <section className="admin-card mt-6 overflow-hidden">
      <header className="border-b border-admin-border bg-admin-bg/60 px-4 py-3 text-[13px] font-semibold">
        Présent dans {usage.length} bento{usage.length > 1 ? 's' : ''}
      </header>
      {usage.length === 0 ? (
        <div className="px-4 py-6 text-center text-[12px] text-admin-muted">
          Cet item n&apos;est encore dans aucun bento.
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-admin-border">
          {usage.map((u) => (
            <li key={u.bentoId} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
              <Link
                href={`/bentos/${u.bentoId}`}
                className="font-semibold underline-offset-2 hover:underline"
              >
                @{u.pseudo}
              </Link>
              <span
                className={`rounded-full border-2 border-bento-ink px-2 py-px font-mono text-[9px] uppercase tracking-[0.12em] ${
                  u.published ? 'bg-bento-yellow text-bento-ink' : 'bg-admin-bg text-admin-muted'
                }`}
              >
                {u.published ? 'publié' : 'brouillon'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
