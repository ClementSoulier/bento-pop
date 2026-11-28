'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import {
  HTML_MAX_BYTES,
  NEWSLETTER_FROM,
  NEWSLETTER_REPLY_TO,
  PREHEADER_MAX,
  RESEND_UNSUBSCRIBE_URL,
  SUBJECT_MAX,
  TEXT_MAX_BYTES,
  byteLength,
  checkIssue,
  checkSchedule,
  renderIssue,
} from '@/lib/newsletter/issue';
import { BACK_TO_DRAFT, ISSUE_COLUMNS, refreshIssue, type IssueRow } from '@/lib/newsletter/issues';
import { loadSubscribers } from '@/lib/newsletter/load-subscribers';
import {
  newsletterResendFromEnv,
  resendErrorMessage,
  type NewsletterResend,
} from '@/lib/newsletter/resend';
import { syncSegment } from '@/lib/newsletter/sync';
import { createServerClient } from '@/lib/supabase/server';

/*
 * Les numéros de la newsletter (docs/NEWSLETTER-ENVOI.md) : enregistrer un
 * brouillon, s'envoyer un test, envoyer ou programmer, annuler, réessayer.
 * Tout passe sous la RLS des admins ; la base refuse elle-même de modifier un
 * numéro qui n'est plus un brouillon, ou de faire repartir un numéro envoyé.
 */

type Client = Awaited<ReturnType<typeof createServerClient>>;
export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

const NOT_CONFIGURED =
  'L’envoi n’est pas encore branché : il attend RESEND_NEWSLETTER_API_KEY et RESEND_NEWSLETTER_SEGMENT_ID sur l’app back-office (Coolify, variables runtime).';

const issueId = z.string().uuid('Identifiant invalide');

const contentSchema = z.object({
  id: z.string().uuid().optional(),
  subject: z.string().max(SUBJECT_MAX, `L’objet dépasse ${SUBJECT_MAX} caractères.`),
  preheader: z.string().max(PREHEADER_MAX, `Le texte d’aperçu dépasse ${PREHEADER_MAX} caractères.`),
  html: z
    .string()
    .refine((v) => byteLength(v) <= HTML_MAX_BYTES, 'Le contenu HTML dépasse 500 Ko.'),
  text: z
    .string()
    .refine((v) => byteLength(v) <= TEXT_MAX_BYTES, 'La version texte dépasse 200 Ko.'),
});

export type IssuePayload = z.infer<typeof contentSchema>;

function landingUrl(): string {
  return (process.env.LANDING_URL || 'https://bento-pop.com').replace(/\/+$/, '');
}

function revalidate(id?: string) {
  revalidatePath('/newsletter/numeros');
  if (id) revalidatePath(`/newsletter/numeros/${id}`);
}

async function loadIssue(supabase: Client, id: string): Promise<IssueRow | null> {
  const { data } = await supabase.from('newsletter_issues').select(ISSUE_COLUMNS).eq('id', id).maybeSingle();
  return (data as unknown as IssueRow | null) ?? null;
}

function firstBlockingError(issue: IssueRow): string | null {
  return checkIssue(issue).find((c) => c.level === 'error')?.message ?? null;
}

export async function saveIssue(input: IssuePayload): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdmin();
  const parsed = contentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Champs invalides' };
  const { id, ...content } = parsed.data;
  const supabase = await createServerClient();

  if (id) {
    const { data, error } = await supabase
      .from('newsletter_issues')
      .update(content as never)
      .eq('id', id)
      .eq('status', 'draft')
      .select('id');
    if (error) return { ok: false, error: error.message };
    if (!data || data.length === 0) {
      return { ok: false, error: 'Ce numéro n’est plus un brouillon : il ne se modifie plus.' };
    }
    revalidate(id);
    return { ok: true, id };
  }

  const { data, error } = await supabase
    .from('newsletter_issues')
    .insert({ ...content, created_by: session.userId } as never)
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Création échouée' };
  const created = (data as unknown as { id: string }).id;
  revalidate(created);
  return { ok: true, id: created };
}

export async function deleteIssue(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!issueId.safeParse(id).success) return { ok: false, error: 'Identifiant invalide' };
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('newsletter_issues')
    .delete()
    .eq('id', id)
    .eq('status', 'draft')
    .select('id');
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: 'Seul un brouillon s’efface.' };
  revalidate();
  return { ok: true };
}

/**
 * Un vrai mail, par l'API classique de Resend (D5) : il compte pour 1 dans
 * les 100 mails du jour du plan gratuit. Le lien de désinscription mène à la
 * page Confidentialité, le vrai lien n'existant que dans un Broadcast.
 */
export async function sendTestIssue(id: string, to: string): Promise<ActionResult<{ to: string }>> {
  await requireAdmin();
  if (!issueId.safeParse(id).success) return { ok: false, error: 'Identifiant invalide' };
  const email = z.string().trim().toLowerCase().email().max(254).safeParse(to);
  if (!email.success) return { ok: false, error: 'Adresse de test invalide.' };
  const nr = newsletterResendFromEnv();
  if (!nr) return { ok: false, error: NOT_CONFIGURED };

  const supabase = await createServerClient();
  const issue = await loadIssue(supabase, id);
  if (!issue) return { ok: false, error: 'Numéro introuvable.' };
  if (!issue.subject.trim() || !issue.html.trim()) {
    return { ok: false, error: 'Il faut un objet et un contenu HTML pour envoyer un test.' };
  }

  const { html, text } = renderIssue(issue, `${landingUrl()}/confidentialite#newsletter`);
  try {
    await nr.resend.sendEmail({
      from: NEWSLETTER_FROM,
      to: [email.data],
      reply_to: NEWSLETTER_REPLY_TO,
      subject: `[Test] ${issue.subject}`,
      html,
      text: text || undefined,
    });
  } catch (e) {
    return { ok: false, error: `Le test n’est pas parti : ${resendErrorMessage(e)}` };
  }
  return { ok: true, to: email.data };
}

/**
 * Première moitié de l'envoi (D6) : aligne la liste de Resend sur la nôtre et
 * rend le nombre exact de destinataires, que la confirmation affiche.
 */
export async function prepareSend(id: string): Promise<ActionResult<{ recipients: number }>> {
  await requireAdmin();
  if (!issueId.safeParse(id).success) return { ok: false, error: 'Identifiant invalide' };
  const nr = newsletterResendFromEnv();
  if (!nr) return { ok: false, error: NOT_CONFIGURED };

  const supabase = await createServerClient();
  const issue = await loadIssue(supabase, id);
  if (!issue) return { ok: false, error: 'Numéro introuvable.' };
  if (issue.status !== 'draft') return { ok: false, error: 'Ce numéro est déjà parti ou en cours d’envoi.' };
  const blocking = firstBlockingError(issue);
  if (blocking) return { ok: false, error: blocking };

  const { rows, error } = await loadSubscribers(supabase);
  if (error) return { ok: false, error: `La liste des inscrits n’a pas pu être lue : ${error}` };
  if (rows.length === 0) return { ok: false, error: 'Personne n’est inscrit : rien à envoyer.' };

  let result;
  try {
    result = await syncSegment({
      resend: nr.resend,
      segmentId: nr.segmentId,
      subscribers: rows.map((r) => r.email),
      eraseSubscribers: async (emails) => {
        const { error: eraseError } = await supabase
          .from('landing_newsletter_subscribers')
          .delete()
          .in('email', emails);
        if (eraseError) throw new Error(eraseError.message);
      },
    });
  } catch (e) {
    return { ok: false, error: `La liste n’a pas pu être alignée chez Resend : ${resendErrorMessage(e)}` };
  }
  if (result.erased > 0) revalidatePath('/newsletter');
  if (result.failed > 0) {
    return {
      ok: false,
      error: `${result.failed} adresse${result.failed > 1 ? 's n’ont' : ' n’a'} pas pu être ajoutée${result.failed > 1 ? 's' : ''} chez Resend. Réessayer dans un instant.`,
    };
  }
  if (result.recipients === 0) return { ok: false, error: 'Personne n’est inscrit : rien à envoyer.' };
  return { ok: true, recipients: result.recipients };
}

/** Confie le Broadcast à Resend, tout de suite ou à l'heure dite. */
async function finishSend(
  supabase: Client,
  nr: NewsletterResend,
  id: string,
  broadcastId: string,
  scheduledAt: string | null,
): Promise<ActionResult> {
  try {
    await nr.resend.sendBroadcast(broadcastId, scheduledAt);
  } catch (e) {
    const message = resendErrorMessage(e);
    await supabase
      .from('newsletter_issues')
      .update({ last_error: `Resend n’a pas confirmé l’envoi : ${message}` } as never)
      .eq('id', id);
    revalidate(id);
    return {
      ok: false,
      error: `Resend n’a pas confirmé l’envoi (${message}). « Réessayer » relance ce même envoi sans risque de doublon ; « Annuler » ramène le numéro en brouillon.`,
    };
  }
  await supabase
    .from('newsletter_issues')
    .update({ status: scheduledAt ? 'scheduled' : 'sending', last_error: null } as never)
    .eq('id', id)
    .eq('status', 'sending');
  revalidate(id);
  revalidatePath('/newsletter');
  return { ok: true };
}

/**
 * Seconde moitié de l'envoi : le verrou (D4), puis le Broadcast. Le passage de
 * brouillon à envoi est une seule écriture conditionnelle : deux clics, deux
 * onglets ou deux admins n'envoient qu'une fois.
 */
export async function sendIssue(
  id: string,
  scheduledAt: string | null,
  recipients: number,
): Promise<ActionResult> {
  await requireAdmin();
  if (!issueId.safeParse(id).success) return { ok: false, error: 'Identifiant invalide' };
  if (!Number.isInteger(recipients) || recipients < 1) return { ok: false, error: 'Destinataires invalides.' };
  if (scheduledAt) {
    const scheduleError = checkSchedule(scheduledAt);
    if (scheduleError) return { ok: false, error: scheduleError };
  }
  const nr = newsletterResendFromEnv();
  if (!nr) return { ok: false, error: NOT_CONFIGURED };

  const supabase = await createServerClient();
  const issue = await loadIssue(supabase, id);
  if (!issue) return { ok: false, error: 'Numéro introuvable.' };
  if (issue.status !== 'draft') return { ok: false, error: 'Ce numéro est déjà parti ou en cours d’envoi.' };
  const blocking = firstBlockingError(issue);
  if (blocking) return { ok: false, error: blocking };

  const at = scheduledAt ? new Date(scheduledAt).toISOString() : null;
  const { data: locked, error: lockError } = await supabase
    .from('newsletter_issues')
    .update({ status: 'sending', scheduled_at: at, recipients, last_error: null } as never)
    .eq('id', id)
    .eq('status', 'draft')
    .select('id');
  if (lockError) return { ok: false, error: lockError.message };
  if (!locked || locked.length === 0) {
    return { ok: false, error: 'Ce numéro vient de partir, ou un autre envoi est en cours.' };
  }

  const { html, text } = renderIssue(issue, RESEND_UNSUBSCRIBE_URL);
  let broadcastId: string;
  try {
    const created = await nr.resend.createBroadcast({
      segmentId: nr.segmentId,
      from: NEWSLETTER_FROM,
      replyTo: NEWSLETTER_REPLY_TO,
      subject: issue.subject,
      html,
      text,
      name: `Newsletter · ${issue.subject}`.slice(0, 120),
    });
    broadcastId = created.id;
  } catch (e) {
    const message = resendErrorMessage(e);
    await supabase
      .from('newsletter_issues')
      .update({ ...BACK_TO_DRAFT, last_error: message } as never)
      .eq('id', id)
      .eq('status', 'sending');
    revalidate(id);
    return { ok: false, error: `Resend a refusé le numéro : ${message}` };
  }

  await supabase
    .from('newsletter_issues')
    .update({ resend_broadcast_id: broadcastId } as never)
    .eq('id', id);
  return finishSend(supabase, nr, id, broadcastId, at);
}

/** Relance un envoi resté sans confirmation, sans jamais doubler un Broadcast parti. */
export async function retrySend(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!issueId.safeParse(id).success) return { ok: false, error: 'Identifiant invalide' };
  const supabase = await createServerClient();
  const issue = await loadIssue(supabase, id);
  if (!issue) return { ok: false, error: 'Numéro introuvable.' };
  if (issue.status !== 'sending') return { ok: false, error: 'Rien à relancer.' };

  if (!issue.resend_broadcast_id) {
    // Le verrou a été posé mais rien n'a été confié à Resend.
    await supabase
      .from('newsletter_issues')
      .update({ ...BACK_TO_DRAFT, last_error: null } as never)
      .eq('id', id)
      .eq('status', 'sending');
    revalidate(id);
    return { ok: true };
  }

  const nr = newsletterResendFromEnv();
  if (!nr) return { ok: false, error: NOT_CONFIGURED };
  let status: string;
  try {
    status = (await nr.resend.getBroadcast(issue.resend_broadcast_id)).status;
  } catch (e) {
    return { ok: false, error: `Resend ne répond pas : ${resendErrorMessage(e)}` };
  }
  if (status !== 'draft') {
    // Resend a bien reçu l'envoi : on se met à jour, rien ne repart.
    await refreshIssue(supabase, nr, issue);
    revalidate(id);
    return { ok: true };
  }
  if (issue.scheduled_at && Date.parse(issue.scheduled_at) < Date.now() + 60_000) {
    return { ok: false, error: 'L’heure programmée est passée : annuler, puis reprogrammer.' };
  }
  return finishSend(supabase, nr, id, issue.resend_broadcast_id, issue.scheduled_at);
}

/** Annule un envoi programmé, ou resté sans confirmation : le numéro redevient brouillon. */
export async function cancelIssue(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!issueId.safeParse(id).success) return { ok: false, error: 'Identifiant invalide' };
  const supabase = await createServerClient();
  const issue = await loadIssue(supabase, id);
  if (!issue) return { ok: false, error: 'Numéro introuvable.' };
  if (issue.status !== 'scheduled' && issue.status !== 'sending') {
    return { ok: false, error: 'Rien à annuler.' };
  }

  if (issue.resend_broadcast_id) {
    const nr = newsletterResendFromEnv();
    if (!nr) return { ok: false, error: NOT_CONFIGURED };
    try {
      await nr.resend.deleteBroadcast(issue.resend_broadcast_id);
    } catch (e) {
      await refreshIssue(supabase, nr, issue);
      revalidate(id);
      return { ok: false, error: `Trop tard pour annuler : ${resendErrorMessage(e)}` };
    }
  }

  const { data, error } = await supabase
    .from('newsletter_issues')
    .update({ ...BACK_TO_DRAFT, last_error: null } as never)
    .eq('id', id)
    .in('status', ['scheduled', 'sending'])
    .select('id');
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: 'Le numéro a changé entre-temps : recharger la page.' };
  revalidate(id);
  revalidatePath('/newsletter');
  return { ok: true };
}
