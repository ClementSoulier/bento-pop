/**
 * Qui reçoit une notification. Chantier 17, §6.5 et D6 à D8.
 *
 * La requête qui lit les appareils filtre déjà de la même façon : cette
 * fonction est la règle, écrite une fois et testée, et elle garde l'envoi
 * même si la requête changeait.
 */

/** Un appareil qu'on n'a pas vu depuis 60 jours ne reçoit plus rien (D7). */
export const PUSH_TOKEN_STALE_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

export type PushTokenRow = {
  id: string;
  user_id: string;
  token: string;
  transactional: boolean;
  editorial: boolean;
  last_seen_at: string;
  revoked_at: string | null;
};

export function staleCutoff(now: Date): Date {
  return new Date(now.getTime() - PUSH_TOKEN_STALE_DAYS * DAY_MS);
}

export type PushAudience =
  /** Les appareils de l'auteur, s'il y en a un. */
  | { kind: 'item_moderated'; authorId: string | null }
  /** Tous ceux qui ont accepté les éditions (D6). */
  | { kind: 'edition_released' };

export function selectRecipients(
  audience: PushAudience,
  tokens: PushTokenRow[],
  now: Date,
): PushTokenRow[] {
  if (audience.kind === 'item_moderated' && !audience.authorId) return [];
  const cutoff = staleCutoff(now).getTime();
  const seen = new Set<string>();

  return tokens.filter((t) => {
    if (t.revoked_at !== null) return false;
    const lastSeen = Date.parse(t.last_seen_at);
    if (Number.isNaN(lastSeen) || lastSeen < cutoff) return false;
    if (audience.kind === 'item_moderated') {
      if (t.user_id !== audience.authorId || !t.transactional) return false;
    } else if (!t.editorial) {
      return false;
    }
    // Un jeton est unique en base ; ceinture, pour ne jamais notifier deux fois.
    if (seen.has(t.token)) return false;
    seen.add(t.token);
    return true;
  });
}
