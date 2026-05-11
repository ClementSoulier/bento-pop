import { PageShell } from '@/components/AppShell/PageShell';
import { createMobileClient } from '@/lib/supabase/mobile';
import { ReportsClient, type ReportRow } from './ReportsClient';

export const dynamic = 'force-dynamic';

/**
 * Modération des signalements UGC (Apple guideline 1.2).
 *
 * Toutes les rangées de `public.reports` avec leur user cible joint.
 * Sépare visuellement « En attente » des « Traités » pour focus l'admin
 * sur l'action restante.
 */
export default async function ReportsPage() {
  const mobile = createMobileClient();
  if (!mobile) {
    return (
      <PageShell crumbs="Modération" title="Signalements">
        <div className="admin-card p-6 text-[14px] text-admin-muted">
          Supabase mobile non configuré (cf. <code>MOBILE_SUPABASE_URL</code> /
          <code>MOBILE_SUPABASE_SERVICE_ROLE_KEY</code>).
        </div>
      </PageShell>
    );
  }

  // 1. Fetch reports (tous statuts, tri par date desc)
  const { data: reports } = await mobile
    .from('reports')
    .select(
      'id, reporter_id, target_kind, target_pseudo, target_bento_id, reason, status, created_at, reviewed_at, reviewed_by',
    )
    .order('created_at', { ascending: false })
    .limit(200);

  // 2. Fetch user cible (par pseudo) — pour avoir le user_id à utiliser dans banUser
  const targetPseudos = [...new Set((reports ?? []).map((r) => r.target_pseudo.toLowerCase()))];
  const { data: users } = targetPseudos.length
    ? await mobile.from('users').select('id, pseudo').in('pseudo', targetPseudos)
    : { data: [] as { id: string; pseudo: string }[] };

  // pnpm.overrides peut return pseudo case-différent — index lowercase pour match
  const userIdByPseudo = new Map(
    (users ?? []).map((u) => [u.pseudo.toLowerCase(), u.id]),
  );

  const rows: ReportRow[] = (reports ?? []).map((r) => ({
    id: r.id,
    targetKind: r.target_kind,
    targetPseudo: r.target_pseudo,
    targetUserId: userIdByPseudo.get(r.target_pseudo.toLowerCase()) ?? null,
    targetBentoId: r.target_bento_id,
    reason: r.reason,
    status: r.status,
    createdAt: r.created_at,
    reviewedAt: r.reviewed_at,
    reviewedBy: r.reviewed_by,
  }));

  const pending = rows.filter((r) => r.status === 'pending');
  const handled = rows.filter((r) => r.status !== 'pending');

  return (
    <PageShell
      crumbs={`Modération · ${pending.length} en attente · ${handled.length} traités`}
      title="Signalements"
    >
      <ReportsClient pending={pending} handled={handled} />
    </PageShell>
  );
}
