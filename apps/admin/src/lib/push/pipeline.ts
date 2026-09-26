import { type AnnounceableEdition, announcementTtlSeconds, planAnnouncements } from './announce';
import {
  type ModerationStatus,
  type PushKind,
  type PushMessage,
  buildMessage,
  editionReleasedText,
  itemModeratedText,
} from './content';
import { type PushTokenRow, selectRecipients, staleCutoff } from './recipients';
import {
  type PushReceipt,
  type PushTicket,
  REQUEST_FAILED,
  type TicketToCheck,
  type TicketsReading,
  readReceipts,
  readTickets,
} from './tickets';

/**
 * Les deux parcours de l'envoi, sans réseau ni base : ceux-ci passent par
 * `PushStore` et `PushSender`, que `store.ts` et `sender.ts` branchent sur
 * Supabase et Expo, et que les tests simulent. Chantier 17, §6.1.
 */

/** Expo conseille de relire un accusé 15 minutes après l'envoi… */
export const RECEIPT_DELAY_MS = 15 * 60 * 1000;
/** … et l'efface à 24 heures. */
export const RECEIPT_LIFETIME_MS = 24 * 60 * 60 * 1000;

export type ItemForPush = {
  id: string;
  title: string;
  status: string;
  submittedBy: string | null;
  rejectedReason: string | null;
  /** Pour une fusion : l'item conservé, qui remplit désormais la case. */
  keptItemId: string | null;
  keptTitle: string | null;
};

/** Le bento que la validation dit avoir publié, relu avant de l'annoncer. */
export type BentoForPush = {
  id: string;
  userId: string;
  publishedAt: string | null;
};

export type NewTicket = {
  ticketId: string;
  tokenId: string;
  kind: PushKind;
  itemId?: string;
  editionId?: number;
};

export type PushStore = {
  item(id: string): Promise<ItemForPush | null>;
  bento(id: string): Promise<BentoForPush | null>;
  /** Les appareils du compte, non révoqués et vus depuis `seenSince`. */
  tokensOfUser(userId: string, seenSince: Date): Promise<PushTokenRow[]>;
  /** Les appareils qui ont accepté les éditions, mêmes filtres. */
  editorialTokens(seenSince: Date): Promise<PushTokenRow[]>;
  saveTickets(tickets: NewTicket[]): Promise<void>;
  revokeTokens(tokenIds: string[], at: Date): Promise<void>;
  /** Les éditions sorties dans la fenêtre et pas encore annoncées. */
  dueEditions(now: Date): Promise<AnnounceableEdition[]>;
  /** Pose `announced_at` si personne ne l'a fait : vrai si c'est nous. */
  claimEdition(id: number, at: Date): Promise<boolean>;
  releaseEdition(id: number): Promise<void>;
  /** Marque `expired` les tickets jamais relus d'avant `createdBefore`. */
  expireTickets(createdBefore: Date, at: Date): Promise<number>;
  ticketsToCheck(createdBefore: Date, createdAfter: Date): Promise<TicketToCheck[]>;
  saveReceipts(checked: { ticketId: string; status: string }[], at: Date): Promise<void>;
  noteSent(kind: PushKind, at: Date): Promise<void>;
  noteError(message: string, at: Date): Promise<void>;
};

export type PushSender = {
  /** Un ticket par message, dans l'ordre. Ne lève pas : un lot échoué rend des tickets `RequestFailed`. */
  send(messages: PushMessage[]): Promise<PushTicket[]>;
  receipts(ticketIds: string[]): Promise<Record<string, PushReceipt>>;
};

export type PushDeps = { store: PushStore; sender: PushSender; now: () => Date };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function summarize(errors: string[]): string {
  const [first = 'Erreur inconnue', ...others] = errors;
  return others.length > 0 ? `${first} (et ${others.length} autre${others.length > 1 ? 's' : ''})` : first;
}

/**
 * Envoie, range les tickets acceptés, révoque, et tient le contrôle de santé.
 * Commun aux deux notifications.
 */
async function deliver(
  deps: PushDeps,
  now: Date,
  kind: PushKind,
  recipients: PushTokenRow[],
  messages: PushMessage[],
  subject: { itemId: string } | { editionId: number },
): Promise<TicketsReading> {
  let tickets: PushTicket[];
  try {
    tickets = await deps.sender.send(messages);
  } catch (error) {
    // `sender.ts` ne lève pas ; un autre `PushSender` pourrait.
    const failed: PushTicket = {
      status: 'error',
      message: errorMessage(error),
      details: { error: REQUEST_FAILED },
    };
    tickets = messages.map(() => failed);
  }

  const reading = readTickets(
    recipients.map((r) => ({ tokenId: r.id })),
    tickets,
  );

  if (reading.accepted.length > 0) {
    await deps.store.saveTickets(
      reading.accepted.map((a) => ({ ticketId: a.ticketId, tokenId: a.tokenId, kind, ...subject })),
    );
    await deps.store.noteSent(kind, now);
  }
  if (reading.revoke.length > 0) await deps.store.revokeTokens(reading.revoke, now);
  if (reading.errors.length > 0) await deps.store.noteError(summarize(reading.errors), now);
  return reading;
}

// ─── Un item proposé vient d'être modéré ────────────────────────────────

export type ItemOutcome =
  | { state: 'skipped'; reason: 'unknown-item' | 'superseded' | 'no-author' | 'no-recipient' }
  | { state: 'sent'; recipients: number; accepted: number; revoked: number; errors: string[] };

export async function notifyItemModerated(
  event: {
    itemId: string;
    status: ModerationStatus;
    /** Le bento que la base vient de publier à cette validation. Chantier 18. */
    publishedBentoId?: string | null;
  },
  deps: PushDeps,
): Promise<ItemOutcome> {
  const now = deps.now();
  const item = await deps.store.item(event.itemId);
  if (!item) return { state: 'skipped', reason: 'unknown-item' };

  // Validé puis refusé dans la foulée : seul l'état présent parle, et
  // l'événement du refus enverra la bonne notification (§6.5).
  if (item.status !== event.status) return { state: 'skipped', reason: 'superseded' };
  if (!item.submittedBy) return { state: 'skipped', reason: 'no-author' };

  const tokens = await deps.store.tokensOfUser(item.submittedBy, staleCutoff(now));
  const recipients = selectRecipients(
    { kind: 'item_moderated', authorId: item.submittedBy },
    tokens,
    now,
  );
  if (recipients.length === 0) return { state: 'skipped', reason: 'no-recipient' };

  // L'événement dit quel bento la validation a publié (chantier 18, D4) ;
  // on le relit avant de l'annoncer : il doit être à l'auteur, et en ligne.
  let publishedBentoId: string | null = null;
  if (event.publishedBentoId && event.status !== 'rejected') {
    const bento = await deps.store.bento(event.publishedBentoId);
    if (bento && bento.userId === item.submittedBy && bento.publishedAt !== null) {
      publishedBentoId = bento.id;
    }
  }

  const text = itemModeratedText({
    status: event.status,
    title: item.title,
    keptTitle: item.keptTitle,
    reason: item.rejectedReason,
    published: publishedBentoId !== null,
  });
  const data = {
    status: event.status,
    itemId: item.id,
    ...(item.keptItemId ? { keptItemId: item.keptItemId } : {}),
    ...(publishedBentoId ? { publishedBentoId } : {}),
  };
  const messages = recipients.map((r) => buildMessage(r.token, 'item_moderated', text, data));

  const reading = await deliver(deps, now, 'item_moderated', recipients, messages, {
    itemId: item.id,
  });
  return {
    state: 'sent',
    recipients: recipients.length,
    accepted: reading.accepted.length,
    revoked: reading.revoke.length,
    errors: reading.errors,
  };
}

// ─── Le battement : annoncer, puis relire ───────────────────────────────

export type AnnounceOutcome = {
  /** L'édition annoncée, et à combien d'appareils. */
  edition: { id: number; recipients: number; accepted: number } | null;
  /** Les éditions dues en même temps, marquées sans envoi. */
  skipped: number[];
  /** Vrai quand Expo était injoignable : l'édition attend le battement suivant. */
  released: boolean;
};

export async function announceEdition(deps: PushDeps, now: Date): Promise<AnnounceOutcome> {
  const outcome: AnnounceOutcome = { edition: null, skipped: [], released: false };
  const plan = planAnnouncements(await deps.store.dueEditions(now), now);

  for (const edition of plan.skip) {
    if (await deps.store.claimEdition(edition.id, now)) outcome.skipped.push(edition.id);
  }

  const edition = plan.announce;
  if (!edition || edition.released_at === null) return outcome;

  // Réservée avant l'envoi : deux battements ne l'annoncent pas deux fois.
  if (!(await deps.store.claimEdition(edition.id, now))) return outcome;

  const tokens = await deps.store.editorialTokens(staleCutoff(now));
  const recipients = selectRecipients({ kind: 'edition_released' }, tokens, now);
  if (recipients.length === 0) {
    outcome.edition = { id: edition.id, recipients: 0, accepted: 0 };
    return outcome;
  }

  const text = editionReleasedText(edition.title);
  const ttl = announcementTtlSeconds(edition.released_at, now);
  const messages = recipients.map((r) =>
    buildMessage(r.token, 'edition_released', text, { editionId: edition.id, slug: edition.slug }, ttl),
  );

  const reading = await deliver(deps, now, 'edition_released', recipients, messages, {
    editionId: edition.id,
  });

  if (reading.unreachable) {
    // Rien n'est parti : rendue, le battement suivant réessaie, dans la fenêtre.
    await deps.store.releaseEdition(edition.id);
    outcome.released = true;
  }
  outcome.edition = { id: edition.id, recipients: recipients.length, accepted: reading.accepted.length };
  return outcome;
}

export type ReceiptsOutcome = { checked: number; revoked: number; expired: number; failed: boolean };

export async function checkReceipts(deps: PushDeps, now: Date): Promise<ReceiptsOutcome> {
  const lifetimeStart = new Date(now.getTime() - RECEIPT_LIFETIME_MS);
  const expired = await deps.store.expireTickets(lifetimeStart, now);

  const tickets = await deps.store.ticketsToCheck(
    new Date(now.getTime() - RECEIPT_DELAY_MS),
    lifetimeStart,
  );
  if (tickets.length === 0) return { checked: 0, revoked: 0, expired, failed: false };

  let receipts: Record<string, PushReceipt>;
  try {
    receipts = await deps.sender.receipts(tickets.map((t) => t.ticketId));
  } catch (error) {
    // Les tickets restent à relire : le battement suivant réessaie.
    await deps.store.noteError(`${REQUEST_FAILED} : ${errorMessage(error)}`.slice(0, 500), now);
    return { checked: 0, revoked: 0, expired, failed: true };
  }

  const reading = readReceipts(tickets, receipts);
  if (reading.checked.length > 0) await deps.store.saveReceipts(reading.checked, now);
  if (reading.revoke.length > 0) await deps.store.revokeTokens(reading.revoke, now);
  if (reading.errors.length > 0) await deps.store.noteError(summarize(reading.errors), now);
  return { checked: reading.checked.length, revoked: reading.revoke.length, expired, failed: false };
}

export type TickOutcome = {
  announce: AnnounceOutcome | { error: string };
  receipts: ReceiptsOutcome | { error: string };
};

/**
 * Ce que fait chaque battement, après que la route l'a noté. Une panne de
 * l'annonce n'empêche pas la relecture des accusés, et inversement.
 */
export async function runTick(deps: PushDeps): Promise<TickOutcome> {
  const now = deps.now();

  const guard = async <T>(work: () => Promise<T>): Promise<T | { error: string }> => {
    try {
      return await work();
    } catch (error) {
      const message = `TickFailed : ${errorMessage(error)}`.slice(0, 500);
      await deps.store.noteError(message, now).catch(() => undefined);
      return { error: message };
    }
  };

  return {
    announce: await guard(() => announceEdition(deps, now)),
    receipts: await guard(() => checkReceipts(deps, now)),
  };
}
