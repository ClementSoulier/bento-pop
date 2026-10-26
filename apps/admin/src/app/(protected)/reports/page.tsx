import { PageShell } from '@/components/AppShell/PageShell';
import { createMobileClient } from '@/lib/supabase/mobile';
import { parseRecipients } from '@/lib/moderation/digest';
import { createMailer } from '@/lib/moderation/mailer';
import { purgeModeration } from '@/lib/moderation/store';
import { ModerationClient, type CommentRow, type ReportRow, type WhyRow } from './ReportsClient';

export const dynamic = 'force-dynamic';

/**
 * La modération, chantier 22 (§5.7) : trois onglets depuis le chantier 12.
 *
 * - **Signalements**, en attente d'abord : la cible, son texte tel qu'il était
 *   au signalement, le motif et le détail, le signaleur. Masquer un
 *   commentaire ou un pourquoi, classer, bannir.
 * - **Commentaires** : les 100 derniers, tous bentos confondus, pour les
 *   parcourir sans attendre qu'un signalement arrive.
 * - **Pourquoi** : les 100 derniers écrits, chantier 12 (D9), à masquer ou
 *   rétablir ; c'est aussi là que l'équipe puise sa rubrique.
 *
 * Le mail à l'équipe mène ici (D11). Ce qui a plus d'un an, signalements
 * traités, commentaires et pourquoi masqués, s'efface à l'ouverture (D20).
 */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ onglet?: string }>;
}) {
  const { onglet } = await searchParams;
  const tab = onglet === 'commentaires' ? 'comments' : onglet === 'pourquoi' ? 'whys' : 'reports';

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
      'id, reporter_id, target_kind, target_pseudo, target_bento_id, target_comment_id, target_why_id, target_user_id, reason, reason_code, details, target_text, status, created_at, reviewed_at, reviewed_by, alerted_at',
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
  const whyIds = [
    ...new Set((reports ?? []).map((r) => r.target_why_id).filter(Boolean)),
  ] as string[];
  const { data: targetWhys } = whyIds.length
    ? await mobile.from('bento_whys').select('id, status').in('id', whyIds)
    : { data: [] as { id: string; status: 'visible' | 'hidden' }[] };
  const whyStatus = new Map((targetWhys ?? []).map((w) => [w.id, w.status]));

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
    // Chantier 12 : effacé depuis avec sa case, il ne se masque plus.
    targetWhyId: r.target_why_id,
    targetWhyStatus: r.target_why_id ? (whyStatus.get(r.target_why_id) ?? null) : null,
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

  // 5. Les 100 derniers pourquoi, pour l'onglet du même nom (chantier 12, D9).
  //    Lus à part, sans requête embarquée : l'auteur par son bento, la case par
  //    son intitulé, l'item par la case.
  let whys: WhyRow[] = [];
  if (tab === 'whys') {
    const { data } = await mobile
      .from('bento_whys')
      .select('id, bento_id, category_id, body, status, hidden_reason, updated_at')
      .order('updated_at', { ascending: false })
      .limit(100);
    const whyBentoIds = [...new Set((data ?? []).map((w) => w.bento_id))];
    const categoryIds = [...new Set((data ?? []).map((w) => w.category_id))];
    const [{ data: whyBentos }, { data: cases }, { data: links }] = await Promise.all([
      whyBentoIds.length
        ? mobile.from('bentos').select('id, slug, is_primary, user_id').in('id', whyBentoIds)
        : Promise.resolve({ data: [] as { id: string; slug: string; is_primary: boolean; user_id: string }[] }),
      categoryIds.length
        ? mobile.from('bento_categories').select('id, prompt').in('id', categoryIds)
        : Promise.resolve({ data: [] as { id: number; prompt: string }[] }),
      whyBentoIds.length
        ? mobile.from('bento_items').select('bento_id, category_id, item_id').in('bento_id', whyBentoIds)
        : Promise.resolve({ data: [] as { bento_id: string; category_id: number; item_id: string }[] }),
    ]);
    const ownerIds = [...new Set((whyBentos ?? []).map((b) => b.user_id))];
    const itemIds = [...new Set((links ?? []).map((l) => l.item_id))];
    const [{ data: owners }, { data: items }] = await Promise.all([
      ownerIds.length
        ? mobile.from('users').select('id, pseudo').in('id', ownerIds)
        : Promise.resolve({ data: [] as { id: string; pseudo: string }[] }),
      itemIds.length
        ? mobile.from('items').select('id, title').in('id', itemIds)
        : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    ]);
    const ownerPseudo = new Map((owners ?? []).map((o) => [o.id, o.pseudo]));
    const bentoOfWhy = new Map(
      (whyBentos ?? []).map((b) => [
        b.id,
        { slug: b.slug, isPrimary: b.is_primary, ownerPseudo: ownerPseudo.get(b.user_id) ?? null },
      ]),
    );
    const casePrompt = new Map((cases ?? []).map((c) => [c.id, c.prompt]));
    const itemTitle = new Map((items ?? []).map((i) => [i.id, i.title]));
    const itemOfCase = new Map(
      (links ?? []).map((l) => [`${l.bento_id}:${l.category_id}`, itemTitle.get(l.item_id) ?? null]),
    );
    whys = (data ?? []).map((w) => ({
      id: w.id,
      body: w.body,
      status: w.status,
      hiddenReason: w.hidden_reason,
      updatedAt: w.updated_at,
      casePrompt: casePrompt.get(w.category_id) ?? '?',
      itemTitle: itemOfCase.get(`${w.bento_id}:${w.category_id}`) ?? null,
      bento: bentoOfWhy.get(w.bento_id) ?? null,
    }));
  }

  // 6. Le mail à l'équipe est-il en service ? L'écran le dit quand il ne l'est pas.
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
        whys={whys}
        mailReady={mailReady}
      />
    </PageShell>
  );
}
