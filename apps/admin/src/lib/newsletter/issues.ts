import type { createServerClient } from '@/lib/supabase/server';
import type { IssueStatus } from './issue';
import type { NewsletterResend } from './resend';

type Client = Awaited<ReturnType<typeof createServerClient>>;

export const ISSUE_COLUMNS =
  'id, subject, preheader, html, text, status, scheduled_at, sent_at, recipients, delivered, bounces, complaints, resend_broadcast_id, last_error, created_at, updated_at';

export type IssueRow = {
  id: string;
  subject: string;
  preheader: string;
  html: string;
  text: string;
  status: IssueStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  recipients: number | null;
  delivered: number;
  bounces: number;
  complaints: number;
  resend_broadcast_id: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

/** Ce qui ramène un numéro à l'état de brouillon, Broadcast oublié. */
export const BACK_TO_DRAFT = {
  status: 'draft',
  resend_broadcast_id: null,
  scheduled_at: null,
  recipients: null,
} as const;

export const ISSUE_SUMMARY_COLUMNS =
  'id, subject, status, scheduled_at, sent_at, recipients, delivered, bounces, complaints, resend_broadcast_id, last_error, created_at, updated_at';

/** Une ligne de l'historique : le numéro sans son contenu. */
export type IssueSummary = Omit<IssueRow, 'preheader' | 'html' | 'text'>;

type Refreshable = Pick<IssueRow, 'id' | 'status' | 'resend_broadcast_id' | 'sent_at' | 'scheduled_at'>;

/**
 * Met un numéro confié à Resend à l'heure de son Broadcast : le webhook le
 * fait d'ordinaire au premier mail parti, ceci rattrape un webhook absent ou
 * en retard, et une programmation annulée depuis le tableau de bord de Resend.
 */
export async function refreshIssue<T extends Refreshable>(
  supabase: Client,
  nr: NewsletterResend | null,
  row: T,
  columns: string = ISSUE_COLUMNS,
): Promise<T> {
  if (!nr || !row.resend_broadcast_id) return row;
  if (row.status !== 'sending' && row.status !== 'scheduled') return row;

  let broadcast;
  try {
    broadcast = await nr.resend.getBroadcast(row.resend_broadcast_id);
  } catch (e) {
    console.warn('[newsletter] lecture du Broadcast en échec :', e instanceof Error ? e.message : e);
    return row;
  }

  let patch: Record<string, unknown> | null = null;
  if (broadcast.status === 'sent') {
    patch = { status: 'sent', sent_at: row.sent_at ?? broadcast.sent_at ?? new Date().toISOString() };
  } else if (broadcast.status === 'queued' && row.status === 'scheduled') {
    patch = { status: 'sending' };
  } else if (broadcast.status === 'scheduled' && row.status === 'sending' && row.scheduled_at) {
    patch = { status: 'scheduled' };
  } else if (
    broadcast.status === 'canceled' ||
    (broadcast.status === 'draft' && row.status === 'scheduled')
  ) {
    patch = { ...BACK_TO_DRAFT, last_error: 'L’envoi a été annulé depuis Resend.' };
  }
  if (!patch) return row;

  const { data, error } = await supabase
    .from('newsletter_issues')
    .update(patch as never)
    .eq('id', row.id)
    .eq('status', row.status)
    .select(columns)
    .maybeSingle();
  if (error || !data) return row;
  return data as unknown as T;
}
