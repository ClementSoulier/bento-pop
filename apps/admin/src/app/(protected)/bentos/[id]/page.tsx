import { notFound } from 'next/navigation';
import Link from 'next/link';
import { PageShell } from '@/components/AppShell/PageShell';
import { createMobileClient } from '@/lib/supabase/mobile';

export const dynamic = 'force-dynamic';

type Params = Promise<{ id: string }>;

/**
 * Vue admin (lecture seule) du bento d'un utilisateur. Tableau simple,
 * pas le rendu public : on veut juste auditer les 6 cases et l'état de
 * modération de chaque item. Lié depuis la liste /bentos et depuis la
 * fiche catalogue d'un item.
 */
export default async function AdminBentoDetailPage({ params }: { params: Params }) {
  const { id } = await params;

  const mobile = createMobileClient();
  if (!mobile) {
    return (
      <PageShell crumbs="Bento" title="Bento">
        <div className="admin-card p-6 text-[14px] text-admin-muted">
          Supabase mobile non configuré.
        </div>
      </PageShell>
    );
  }

  const { data: bento } = await mobile
    .from('bentos')
    .select('id, user_id, published_at, created_at, is_featured')
    .eq('id', id)
    .maybeSingle();
  if (!bento) notFound();

  const [{ data: user }, { data: bentoItems }, { data: categories }] = await Promise.all([
    mobile.from('users').select('pseudo, display_name').eq('id', bento.user_id).maybeSingle(),
    mobile.from('bento_items').select('category_id, item_id, added_at').eq('bento_id', id),
    mobile.from('bento_categories').select('id, label_fr, display_order'),
  ]);

  const itemIds = [...new Set((bentoItems ?? []).map((bi) => bi.item_id))];
  const { data: items } = itemIds.length
    ? await mobile
        .from('items')
        .select('id, title, subtitle, year, image_url, status')
        .in('id', itemIds)
    : { data: [] as ItemLite[] };
  const itemById = new Map((items ?? []).map((it) => [it.id, it as ItemLite]));
  const catById = new Map(
    (categories ?? []).map((c) => [c.id, { label: c.label_fr, order: c.display_order }]),
  );

  const rows: BentoCaseRow[] = (bentoItems ?? [])
    .map((bi) => {
      const it = itemById.get(bi.item_id);
      const cat = catById.get(bi.category_id);
      return {
        categoryLabel: cat?.label ?? '?',
        categoryOrder: cat?.order ?? 99,
        itemId: bi.item_id,
        title: it?.title ?? '(item introuvable)',
        subtitle: it?.subtitle ?? null,
        year: it?.year ?? null,
        hasImage: Boolean(it?.image_url),
        status: (it?.status ?? 'rejected') as ItemStatus,
      };
    })
    .sort((a, b) => a.categoryOrder - b.categoryOrder);

  const pseudo = user?.pseudo ?? '(supprimé)';
  const published = Boolean(bento.published_at);

  return (
    <PageShell
      crumbs={`Bentos · @${pseudo} · ${rows.length}/6 case${rows.length > 1 ? 's' : ''}`}
      title={`@${pseudo}`}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3 text-[12px] text-admin-muted">
          <span
            className={`rounded-full border-2 border-bento-ink px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${
              published ? 'bg-bento-yellow text-bento-ink' : 'bg-admin-bg text-admin-muted'
            }`}
          >
            {published ? 'publié' : 'brouillon'}
          </span>
          {bento.is_featured ? (
            <span className="rounded-full border-2 border-bento-ink bg-bento-red px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-bento-cream">
              ★ featured
            </span>
          ) : null}
          {published ? (
            <a
              href={`https://bento-pop.com/u/${pseudo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[11px] uppercase tracking-[0.12em] hover:text-admin-ink"
            >
              Voir la page publique →
            </a>
          ) : null}
        </div>

        <section className="admin-card overflow-hidden">
          {rows.length === 0 ? (
            <div className="px-4 py-6 text-center text-[12px] text-admin-muted">
              Ce bento ne contient aucune case.
            </div>
          ) : (
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-admin-border text-left font-mono text-[9px] uppercase tracking-[0.15em] text-admin-muted">
                  <th className="px-4 py-2 font-medium">Case</th>
                  <th className="px-2 py-2 font-medium">Titre</th>
                  <th className="px-2 py-2 font-medium">Sous-titre</th>
                  <th className="px-2 py-2 font-medium">Date</th>
                  <th className="px-2 py-2 text-center font-medium">Img</th>
                  <th className="px-4 py-2 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-border">
                {rows.map((r) => {
                  const meta = STATUS_META[r.status];
                  return (
                    <tr key={r.itemId} className="hover:bg-admin-bg/50">
                      <td className="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-admin-muted">
                        {r.categoryLabel}
                      </td>
                      <td className="max-w-[260px] px-2 py-2">
                        <Link
                          href={`/catalogue/${r.itemId}`}
                          className="block truncate font-semibold underline-offset-2 hover:underline"
                          title={r.title}
                        >
                          {r.title}
                        </Link>
                      </td>
                      <td
                        className="max-w-[200px] truncate px-2 py-2 text-admin-muted"
                        title={r.subtitle ?? ''}
                      >
                        {r.subtitle ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 font-mono text-[11px] text-admin-muted">
                        {r.year ?? '—'}
                      </td>
                      <td className="px-2 py-2 text-center font-mono text-[11px]">
                        {r.hasImage ? (
                          <span className="text-bento-ink">●</span>
                        ) : (
                          <span className="text-admin-muted opacity-40">○</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-block rounded-full border-2 border-bento-ink px-2 py-px font-mono text-[9px] uppercase tracking-[0.12em] ${meta.cls}`}
                        >
                          {meta.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </PageShell>
  );
}

type ItemStatus = 'draft' | 'pending' | 'validated' | 'rejected' | 'merged';
type ItemLite = {
  id: string;
  title: string;
  subtitle: string | null;
  year: number | null;
  image_url: string | null;
  status: ItemStatus;
};
type BentoCaseRow = {
  categoryLabel: string;
  categoryOrder: number;
  itemId: string;
  title: string;
  subtitle: string | null;
  year: number | null;
  hasImage: boolean;
  status: ItemStatus;
};

const STATUS_META: Record<ItemStatus, { label: string; cls: string }> = {
  validated: { label: 'validé', cls: 'bg-bento-yellow text-bento-ink' },
  pending: { label: 'en attente', cls: 'bg-bento-red/15 text-bento-red' },
  draft: { label: 'brouillon', cls: 'bg-admin-bg text-admin-muted' },
  rejected: { label: 'rejeté', cls: 'bg-admin-bg text-admin-muted line-through' },
  merged: { label: 'fusionné', cls: 'bg-admin-bg text-admin-muted' },
};
