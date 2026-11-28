import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { removalMessage, unsubscriptionMessage } from '@/lib/newsletter/discord';
import { NEWSLETTER_DOMAIN, bestEffort, newsletterContactsFromEnv } from '@/lib/newsletter/resend';
import { SUBSCRIBERS_TABLE, notifyTeam } from '@/lib/newsletter/team';
import { planWebhookEvent, verifySvix } from '@/lib/newsletter/webhook';

/**
 * Le webhook de Resend pour la newsletter (docs/NEWSLETTER-ENVOI.md, §6).
 *
 *   - `contact.updated` désinscrit : l'adresse est effacée chez nous et chez
 *     Resend, et l'équipe le sait sur Discord ;
 *   - `email.bounced` définitif ou `email.complained` : pareil, et compté sur
 *     le numéro ;
 *   - `email.sent` : compté sur le numéro, qui passe à « envoyé ».
 *
 * Signature vérifiée par `RESEND_WEBHOOK_SECRET` (variable runtime de la
 * landing). Une erreur de base répond 500 pour que Resend réessaie :
 * l'effacement se rejoue sans dommage, et l'événement n'est compté qu'une
 * fois (`newsletter_record_event`).
 */
export const dynamic = 'force-dynamic';

const ok = () => NextResponse.json({ ok: true });

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: 'webhook non configuré' }, { status: 503 });

  const body = await request.text();
  const headers = {
    id: request.headers.get('svix-id'),
    timestamp: request.headers.get('svix-timestamp'),
    signature: request.headers.get('svix-signature'),
  };
  if (!verifySvix(secret, headers, body)) {
    return NextResponse.json({ error: 'signature invalide' }, { status: 401 });
  }

  let event: { type?: string; created_at?: string };
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'corps illisible' }, { status: 400 });
  }

  const plan = planWebhookEvent(event, NEWSLETTER_DOMAIN);
  if (plan.kind === 'ignore') return ok();

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: 'base indisponible' }, { status: 503 });

  if (plan.kind === 'erase') {
    const { data, error } = await supabase
      .from(SUBSCRIBERS_TABLE)
      .delete()
      .eq('email', plan.email)
      .select('id');
    if (error) {
      console.error(`[newsletter] webhook, effacement refusé par la base : ${error.code} ${error.message}`);
      return NextResponse.json({ error: 'base' }, { status: 500 });
    }
    const contacts = newsletterContactsFromEnv();
    if (contacts) await bestEffort('contact Resend non effacé', () => contacts.remove(plan.email));
    if (data.length > 0) {
      notifyTeam(supabase, (total) =>
        plan.reason === 'unsubscribe' ? unsubscriptionMessage(total) : removalMessage(plan.reason, total),
      );
    }
  }

  const { error } = await supabase.rpc('newsletter_record_event', {
    p_event_id: headers.id!,
    p_type: String(event.type),
    p_broadcast_id: plan.broadcastId,
    p_at: event.created_at && !Number.isNaN(Date.parse(event.created_at)) ? event.created_at : new Date().toISOString(),
  });
  if (error) {
    console.error(`[newsletter] webhook, événement non compté : ${error.code} ${error.message}`);
    return NextResponse.json({ error: 'base' }, { status: 500 });
  }
  return ok();
}
