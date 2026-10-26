import { PageShell } from '@/components/AppShell/PageShell';
import { createMobileClient } from '@/lib/supabase/mobile';
import { parseRecipients } from '@/lib/moderation/digest';
import { createMailer } from '@/lib/moderation/mailer';
import { purgeModeration } from '@/lib/moderation/store';
import { ModerationClient, type CommentRow, type ReportRow } from './ReportsClient';

export const dynamic = 'force-dynamic';

/**
 * La modération, chantier 22 (§5.7) : deux onglets.
 *
 * - **Signalements**, en attente d'abord : la cible, son texte tel qu'il était
 *   au signalement, le motif et le détail, le signaleur. Masquer un
 *   commentaire, classer, bannir.
 * - **Commentaires** : les 100 derniers, tous bentos confondus, pour les
 *   parcourir sans attendre qu'un signalement arrive.
 *
 * Le mail à l'équipe mène ici (D11). Ce qui a plus d'un an, signalements
 * traités et commentaires masqués, s'efface à l'ouverture (D20).
 */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ onglet?: string }>;
}) {
  const { onglet } = await searchParams;
  const tab = onglet === 'commentaires' ? 'comments' : 'reports';

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

  await purgeModeration(mobile).catch((e) => console.error('[modération] purge', e));

  // 1. Les signalements, tous statuts, du plus récent au plus ancien.
  const { data: reports } = await mobile
    .from('reports')
    .select(
      'id, reporter_id, target_kind, target_pseudo, target_bento_id, target_comment_id, target_user_id, reason, reason_code, details, target_text, status, created_at, reviewed_at, reviewed_by, alerted_at',
    )
    .order('created_at', { ascending: false })
    .limit(200);

  // 2. Les comptes visés, pour bannir. `target_user_id` depuis le chantier 22 ;
  //    par le pseudo pour les signalements d'avant.
  const targetPseudos = [...new Set((reports ?? []).map((r) => r.target_pseudo.toLowerCase()))];
  const reporterIds = [
    ...new Set((reports ?? []).map((r) => r.reporter_id).filter(Boolean)),
  ] as string[];
  const { data: users } =
    targetPseudos.length || reporterIds.length
      ? await mobile
          .from('users')
          .select('id, pseudo')
          .or(
            [
              targetPseudos.length
                ? `pseudo.in.(${targetPseudos.map((p) => `"${p}"`).join(',')})`
                : null,
              reporterIds.length ? `id.in.(${reporterIds.join(',')})` : null,
            ]
              .filter(Boolean)
              .join(','),
          )
      : { data: [] as { id: string; pseudo: string }[] };
  const userIdByPseudo = new Map((users ?? []).map((u) => [u.pseudo.toLowerCase(), u.id]));
  const pseudoById = new Map((users ?? []).map((u) => [u.id, u.pseudo]));

  // 3. Les bentos visés, et l'état des commentaires visés.
  const bentoIds = [
    ...new Set((reports ?? []).map((r) => r.target_bento_id).filter(Boolean)),
  ] as string[];
  const { data: bentos } = bentoIds.length
    ? await mobile.from('bentos').select('id, slug, is_primary').in('id', bentoIds)
    : { data: [] as { id: string; slug: string; is_primary: boolean }[] };
  const bentoById = new Map((bentos ?? []).map((b) => [b.id, b]));
  const commentIds = [
    ...new Set((reports ?? []).map((r) => r.target_comment_id).filter(Boolean)),
  ] as string[];
  const { data: targetComments } = commentIds.length
    ? await mobile.from('bento_comments').select('id, status').in('id', commentIds)
    : { data: [] as { id: string; status: 'visible' | 'hidden' }[] };
  const commentStatus = new Map((targetComments ?? []).map((c) => [c.id, c.status]));

  const rows: ReportRow[] = (reports ?? []).map((r) => ({
    id: r.id,
    targetKind: r.target_kind,
    targetPseudo: r.target_pseudo,
    targetUserId: r.target_user_id ?? userIdByPseudo.get(r.target_pseudo.toLowerCase()) ?? null,
    targetBentoId: r.target_bento_id,
    // Nuls ensemble : un signalement d'avant le chantier 16, ou visant un
    // pseudo plutôt qu'un bento, n'a pas d'adresse à montrer.
    targetBentoSlug: r.target_bento_id ? (bentoById.get(r.target_bento_id)?.slug ?? null) : null,
    targetBentoIsPrimary: r.target_bento_id
      ? (bentoById.get(r.target_bento_id)?.is_primary ?? null)
      : null,
    targetCommentId: r.target_comment_id,
    // Supprimé depuis par son auteur ou le propriétaire : il ne se masque plus,
    // mais son texte reste lisible ici.
    targetCommentStatus: r.target_comment_id
      ? (commentStatus.get(r.target_comment_id) ?? null)
      : null,
    targetText: r.target_text,
    reason: r.reason,
    reasonCode: r.reason_code,
    details: r.details,
    reporterPseudo: r.reporter_id ? (pseudoById.get(r.reporter_id) ?? null) : null,
    status: r.status,
    createdAt: r.created_at,
    reviewedAt: r.reviewed_at,
    reviewedBy: r.reviewed_by,
  }));

  const pending = rows.filter((r) => r.status === 'pending');
  const handled = rows.filter((r) => r.status !== 'pending');

  // 4. Les 100 derniers commentaires, pour l'onglet du même nom.
  let comments: CommentRow[] = [];
  if (tab === 'comments') {
    const { data } = await mobile
      .from('bento_comments')
      .select('id, body, status, hidden_reason, created_at, author_id, bento_id')
      .order('created_at', { ascending: false })
      .limit(100);
    const commentBentoIds = [...new Set((data ?? []).map((c) => c.bento_id))];
    const { data: commentBentos } = commentBentoIds.length
      ? await mobile
          .from('bentos')
          .select('id, slug, is_primary, user_id')
          .in('id', commentBentoIds)
      : { data: [] as { id: string; slug: string; is_primary: boolean; user_id: string }[] };
    const peopleIds = [
      ...new Set([
        ...(data ?? []).map((c) => c.author_id),
        ...(commentBentos ?? []).map((b) => b.user_id),
      ]),
    ];
    const { data: people } = peopleIds.length
      ? await mobile.from('users').select('id, pseudo').in('id', peopleIds)
      : { data: [] as { id: string; pseudo: string }[] };
    const authorPseudo = new Map((people ?? []).map((a) => [a.id, a.pseudo]));
    const bentoOf = new Map(
      (commentBentos ?? []).map((b) => [
        b.id,
        { slug: b.slug, isPrimary: b.is_primary, ownerPseudo: authorPseudo.get(b.user_id) ?? null },
      ]),
    );
    comments = (data ?? []).map((c) => ({
      id: c.id,
      body: c.body,
      status: c.status,
      hiddenReason: c.hidden_reason,
      createdAt: c.created_at,
      authorPseudo: authorPseudo.get(c.author_id) ?? '?',
      bento: bentoOf.get(c.bento_id) ?? null,
    }));
  }

  // 5. Le mail à l'équipe est-il en service ? L'écran le dit quand il ne l'est pas.
  const mailReady =
    Boolean(createMailer()) &&
    parseRecipients(process.env.MODERATION_ALERT_TO).length > 0 &&
    Boolean(process.env.ADMIN_PUBLIC_URL);

  return (
    <PageShell
      crumbs={`Modération · ${pending.length} en attente · ${handled.length} traités`}
      title="Modération"
    >
      <ModerationClient
        tab={tab}
        pending={pending}
        handled={handled}
        comments={comments}
        mailReady={mailReady}
      />
    </PageShell>
  );
}
