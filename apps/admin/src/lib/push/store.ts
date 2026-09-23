import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@bento-pop/supabase-mobile/types';
import { EDITION_ANNOUNCE_WINDOW_MS } from './announce';
import type { PushKind } from './content';
import type { PushStore } from './pipeline';
import { type PushTokenRow, staleCutoff } from './recipients';

/**
 * `PushStore` sur le projet Supabase mobile, à la clé de service.
 *
 * Deux limites de la passerelle, tenues ici :
 *   - une lecture rend au plus 1 000 lignes : les listes se lisent par pages ;
 *   - les filtres d'une écriture voyagent dans l'adresse : les listes
 *     d'identifiants s'envoient par paquets de 100.
 */

type MobileClient = SupabaseClient<Database>;

const PAGE = 1000;
const BATCH = 100;
/** De quoi relire 3 000 accusés par battement, 864 000 par jour. */
const MAX_TICKETS_PER_TICK = 3 * PAGE;

const TOKEN_COLUMNS = 'id, user_id, token, transactional, editorial, last_seen_at, revoked_at';

function fail(what: string, error: { message: string } | null): void {
  if (error) throw new Error(`${what} : ${error.message}`);
}

function batches<T>(list: T[], size = BATCH): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export function createSupabasePushStore(db: MobileClient): PushStore {
  return {
    async item(id) {
      const { data, error } = await db
        .from('items')
        .select('id, title, status, submitted_by, rejected_reason, merged_into_id')
        .eq('id', id)
        .maybeSingle();
      fail('lecture de l’item', error);
      if (!data) return null;

      let keptTitle: string | null = null;
      if (data.merged_into_id) {
        const kept = await db.from('items').select('title').eq('id', data.merged_into_id).maybeSingle();
        fail('lecture de l’item conservé', kept.error);
        keptTitle = kept.data?.title ?? null;
      }
      return {
        id: data.id,
        title: data.title,
        status: data.status,
        submittedBy: data.submitted_by,
        rejectedReason: data.rejected_reason,
        keptItemId: data.merged_into_id,
        keptTitle,
      };
    },

    async tokensOfUser(userId, seenSince) {
      const { data, error } = await db
        .from('push_tokens')
        .select(TOKEN_COLUMNS)
        .eq('user_id', userId)
        .is('revoked_at', null)
        .gte('last_seen_at', seenSince.toISOString())
        .order('created_at');
      fail('lecture des appareils de l’auteur', error);
      return (data ?? []) as PushTokenRow[];
    },

    async editorialTokens(seenSince) {
      const rows: PushTokenRow[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await db
          .from('push_tokens')
          .select(TOKEN_COLUMNS)
          .eq('editorial', true)
          .is('revoked_at', null)
          .gte('last_seen_at', seenSince.toISOString())
          .order('id')
          .range(from, from + PAGE - 1);
        fail('lecture des appareils abonnés aux éditions', error);
        rows.push(...((data ?? []) as PushTokenRow[]));
        if (!data || data.length < PAGE) return rows;
      }
    },

    async saveTickets(tickets) {
      for (const part of batches(tickets, PAGE)) {
        const { error } = await db.from('push_tickets').insert(
          part.map((t) => ({
            ticket_id: t.ticketId,
            token_id: t.tokenId,
            kind: t.kind,
            item_id: t.itemId ?? null,
            edition_id: t.editionId ?? null,
          })),
        );
        fail('rangement des tickets', error);
      }
    },

    async revokeTokens(tokenIds, at) {
      for (const part of batches([...new Set(tokenIds)])) {
        const { error } = await db
          .from('push_tokens')
          .update({ revoked_at: at.toISOString() })
          .in('id', part)
          .is('revoked_at', null);
        fail('révocation des appareils', error);
      }
    },

    async dueEditions(now) {
      const { data, error } = await db
        .from('editions')
        .select('id, slug, title, released_at, announced_at')
        .is('announced_at', null)
        .lte('released_at', now.toISOString())
        .gt('released_at', new Date(now.getTime() - EDITION_ANNOUNCE_WINDOW_MS).toISOString());
      fail('lecture des éditions à annoncer', error);
      return data ?? [];
    },

    async claimEdition(id, at) {
      // Une seule écriture conditionnelle : si deux battements se croisent,
      // un seul trouve `announced_at` vide. N'appelle pas la landing :
      // son déclencheur ignore ce qui ne touche ni titre, ni adresse, ni sortie.
      const { data, error } = await db
        .from('editions')
        .update({ announced_at: at.toISOString() })
        .eq('id', id)
        .is('announced_at', null)
        .select('id');
      fail('réservation de l’édition', error);
      return (data ?? []).length === 1;
    },

    async releaseEdition(id) {
      const { error } = await db.from('editions').update({ announced_at: null }).eq('id', id);
      fail('libération de l’édition', error);
    },

    async expireTickets(createdBefore, at) {
      const { error, count } = await db
        .from('push_tickets')
        .update({ checked_at: at.toISOString(), receipt_status: 'expired' }, { count: 'exact' })
        .is('checked_at', null)
        .lt('created_at', createdBefore.toISOString());
      fail('expiration des tickets', error);
      return count ?? 0;
    },

    async ticketsToCheck(createdBefore, createdAfter) {
      const rows: { ticketId: string; tokenId: string }[] = [];
      for (let from = 0; from < MAX_TICKETS_PER_TICK; from += PAGE) {
        const { data, error } = await db
          .from('push_tickets')
          .select('ticket_id, token_id')
          .is('checked_at', null)
          .lte('created_at', createdBefore.toISOString())
          .gt('created_at', createdAfter.toISOString())
          .order('created_at')
          .range(from, from + PAGE - 1);
        fail('lecture des tickets à relire', error);
        rows.push(...(data ?? []).map((t) => ({ ticketId: t.ticket_id, tokenId: t.token_id })));
        if (!data || data.length < PAGE) break;
      }
      return rows;
    },

    async saveReceipts(checked, at) {
      const byStatus = new Map<string, string[]>();
      for (const c of checked) byStatus.set(c.status, [...(byStatus.get(c.status) ?? []), c.ticketId]);
      for (const [status, ids] of byStatus) {
        for (const part of batches(ids)) {
          const { error } = await db
            .from('push_tickets')
            .update({ checked_at: at.toISOString(), receipt_status: status })
            .in('ticket_id', part);
          fail('rangement des accusés', error);
        }
      }
    },

    async noteSent(kind: PushKind, at) {
      const { error } = await db
        .from('push_health')
        .update({ last_sent_at: at.toISOString(), last_sent_kind: kind })
        .eq('id', true);
      fail('contrôle de santé, envoi', error);
    },

    async noteError(message, at) {
      const { error } = await db
        .from('push_health')
        .update({ last_error_at: at.toISOString(), last_error: message.slice(0, 500) })
        .eq('id', true);
      fail('contrôle de santé, erreur', error);
    },
  };
}

/** Noté par la route du battement avant de répondre, hors de `PushStore`. */
export async function noteTick(db: MobileClient, at: Date): Promise<void> {
  const { error } = await db
    .from('push_health')
    .update({ last_tick_at: at.toISOString() })
    .eq('id', true);
  fail('contrôle de santé, battement', error);
}

export type PushHealthView = {
  lastTickAt: string | null;
  lastSentAt: string | null;
  lastSentKind: PushKind | null;
  lastErrorAt: string | null;
  lastError: string | null;
  /** Appareils non révoqués, vus depuis moins de 60 jours. */
  activeDevices: number;
  /** Parmi eux, ceux qui ont accepté les éditions. */
  editorialDevices: number;
  /** Appareils révoqués sur `DeviceNotRegistered`. */
  revokedDevices: number;
};

/** Ce que lit la carte du tableau de bord (D19). */
export async function readPushHealth(db: MobileClient, now: Date): Promise<PushHealthView> {
  const since = staleCutoff(now).toISOString();
  const [health, active, editorial, revoked] = await Promise.all([
    db.from('push_health').select('*').eq('id', true).maybeSingle(),
    db
      .from('push_tokens')
      .select('id', { count: 'exact', head: true })
      .is('revoked_at', null)
      .gte('last_seen_at', since),
    db
      .from('push_tokens')
      .select('id', { count: 'exact', head: true })
      .is('revoked_at', null)
      .gte('last_seen_at', since)
      .eq('editorial', true),
    db.from('push_tokens').select('id', { count: 'exact', head: true }).not('revoked_at', 'is', null),
  ]);
  fail('lecture du contrôle de santé', health.error ?? active.error ?? editorial.error ?? revoked.error);

  return {
    lastTickAt: health.data?.last_tick_at ?? null,
    lastSentAt: health.data?.last_sent_at ?? null,
    lastSentKind: health.data?.last_sent_kind ?? null,
    lastErrorAt: health.data?.last_error_at ?? null,
    lastError: health.data?.last_error ?? null,
    activeDevices: active.count ?? 0,
    editorialDevices: editorial.count ?? 0,
    revokedDevices: revoked.count ?? 0,
  };
}
