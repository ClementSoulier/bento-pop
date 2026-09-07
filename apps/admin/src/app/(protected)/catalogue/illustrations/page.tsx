import Link from 'next/link';
import { PageShell } from '@/components/AppShell/PageShell';
import { createMobileClient } from '@/lib/supabase/mobile';
import { IllustrationsClient, type SuggestionGroup } from './IllustrationsClient';

export const dynamic = 'force-dynamic';

/**
 * File de revue des illustrations proposées par le script
 * `catalog-images.mjs` (cf. apps/admin/scripts). Le script illustre tout
 * seul ce dont il est sûr (titre + type Wikidata + licence Commons qui
 * concordent) et dépose ici tout ce qui demande un arbitrage humain :
 * homonymes, catégories où l'image libre n'existe pas (films, séries),
 * descriptions Wikidata manquantes.
 *
 * Un item dont l'image est arrivée entre-temps (upload manuel, autre
 * suggestion) est masqué : ses suggestions restent en base mais n'ont plus
 * d'objet.
 */
export default async function IllustrationsPage() {
  const mobile = createMobileClient();
  if (!mobile) {
    return (
      <PageShell crumbs="Catalogue · illustrations" title="Illustrations à trancher">
        <div className="admin-card p-6 text-[14px] text-admin-muted">
          Supabase mobile non configuré (cf. <code>MOBILE_SUPABASE_URL</code> /
          <code>MOBILE_SUPABASE_SERVICE_ROLE_KEY</code>).
        </div>
      </PageShell>
    );
  }

  const { data: suggestions } = await mobile
    .from('item_image_suggestions')
    .select(
      'id, item_id, source_url, thumbnail_url, attribution, license_code, wikipedia_page_url, fetched_at',
    )
    .eq('status', 'pending')
    .order('fetched_at', { ascending: true })
    .limit(600);

  const itemIds = [...new Set((suggestions ?? []).map((s) => s.item_id))];
  if (itemIds.length === 0) {
    return (
      <PageShell crumbs="Catalogue · illustrations" title="Illustrations à trancher">
        <div className="admin-card p-6 text-[14px] text-admin-muted">
          Aucune suggestion en attente. Lance{' '}
          <code>pnpm --filter @bento-pop/admin catalog:images -- --apply</code> pour en produire.
        </div>
      </PageShell>
    );
  }

  const { data: items } = await mobile
    .from('items')
    .select('id, title, subtitle, year, image_url, category_id, status')
    .in('id', itemIds);

  const { data: categories } = await mobile.from('bento_categories').select('id, label_fr');
  const catLabel = new Map((categories ?? []).map((c) => [c.id, c.label_fr]));

  // Compte de bentos par item : on traite en priorité ce qui est visible.
  const { data: bentoItems } = await mobile.from('bento_items').select('item_id');
  const bentoCount = new Map<string, number>();
  (bentoItems ?? []).forEach((bi) => {
    bentoCount.set(bi.item_id, (bentoCount.get(bi.item_id) ?? 0) + 1);
  });

  const byItem = new Map<string, SuggestionGroup>();
  for (const item of items ?? []) {
    if (item.image_url) continue; // déjà illustré depuis
    if (item.status === 'merged' || item.status === 'rejected') continue;
    byItem.set(item.id, {
      itemId: item.id,
      title: item.title,
      subtitle: item.subtitle ?? null,
      year: item.year ?? null,
      categoryLabel: catLabel.get(item.category_id) ?? '?',
      bentoCount: bentoCount.get(item.id) ?? 0,
      candidates: [],
    });
  }
  for (const suggestion of suggestions ?? []) {
    const group = byItem.get(suggestion.item_id);
    if (!group) continue;
    group.candidates.push({
      id: suggestion.id,
      thumbnailUrl: suggestion.thumbnail_url ?? suggestion.source_url,
      attribution: suggestion.attribution ?? null,
      licenseCode: suggestion.license_code ?? null,
      wikipediaPageUrl: suggestion.wikipedia_page_url ?? null,
    });
  }

  const groups = [...byItem.values()]
    .filter((g) => g.candidates.length > 0)
    .sort((a, b) => b.bentoCount - a.bentoCount || a.title.localeCompare(b.title));

  return (
    <PageShell
      crumbs={`Catalogue · ${groups.length} items à illustrer`}
      title="Illustrations à trancher"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[13px] text-admin-muted">
          Propositions Wikimedia Commons que le script n&apos;a pas osé poser tout seul. Une image
          acceptée est copiée dans le bucket <code>item-images</code> et créditée automatiquement.
        </p>
        <Link
          href="/catalogue"
          className="shrink-0 rounded-md border border-admin-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] hover:bg-admin-ink hover:text-bento-cream"
        >
          ← Catalogue
        </Link>
      </div>
      <IllustrationsClient groups={groups} />
    </PageShell>
  );
}
