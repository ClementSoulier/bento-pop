import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageShell } from '@/components/AppShell/PageShell';
import { EDITION_STATUS_LABELS, loadEdition } from '@/lib/editions';
import { createMobileClient } from '@/lib/supabase/mobile';
import { EditionEditor, type TypeOption } from './EditionEditor';

export const dynamic = 'force-dynamic';

type Params = Promise<{ id: string }>;

/**
 * Décrire les cases d'une édition, et voir ce qu'elles donneront.
 *
 * L'écran existe pour une raison précise : **refuser un intitulé trop long
 * avant que l'édition sorte**. Une fois sortie, des personnes l'ont composée,
 * et corriger une case effacerait leurs items. Le verdict se calcule donc en
 * direct, avec la même règle que l'app, et l'aperçu montre la coupe telle
 * qu'elle se produira.
 *
 * Cf. `docs/UX-13-BENTO-HEBDOMADAIRE.md` §5.4 et §5.7.
 */
export default async function EditionPage({ params }: { params: Params }) {
  const { id: brut } = await params;
  const id = Number(brut);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const mobile = createMobileClient();
  if (!mobile) {
    return (
      <PageShell crumbs="Éditions" title="Édition">
        <div className="admin-card p-6 text-[14px] text-admin-muted">
          Supabase mobile non configuré.
        </div>
      </PageShell>
    );
  }

  const [detail, types] = await Promise.all([
    loadEdition(mobile, id),
    mobile.from('item_types').select('id, label_fr, is_active, display_order').order('display_order'),
  ]);

  if (!detail.ok) {
    return (
      <PageShell crumbs="Éditions" title="Édition">
        <div className="admin-card border-bento-red bg-bento-red/10 p-6 text-[14px] text-bento-red">
          {detail.error}
        </div>
      </PageShell>
    );
  }

  /**
   * Tous les types, actifs ou non. Les quatre dormants du chantier 15 (jeu
   * vidéo, livre, plat, activité) n'ont pas encore de catalogue : une case de
   * ce type ouvrirait une recherche vide. L'écran les propose en le disant,
   * plutôt que de les cacher et de laisser croire qu'ils n'existent pas.
   */
  const options: TypeOption[] = (types.data ?? []).map((t) => ({
    id: t.id as number,
    label: t.label_fr as string,
    active: Boolean(t.is_active),
  }));

  return (
    <PageShell
      crumbs={`Éditions · ${detail.value.edition.slug} · ${EDITION_STATUS_LABELS[detail.value.edition.status]} · ${detail.value.cases.length} cases`}
      title={detail.value.edition.title}
      actions={
        <Link href="/editions" className="admin-btn admin-btn-sm">
          ← Éditions
        </Link>
      }
    >
      <EditionEditor detail={detail.value} types={options} />
    </PageShell>
  );
}
