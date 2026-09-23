/**
 * Ce qu'Expo répond, et ce qu'on en fait. Chantier 17, §4.5 et D7.
 *
 * Deux réponses, à deux moments. Le **ticket**, tout de suite : Expo a pris
 * le message, ou le refuse. L'**accusé de réception**, au moins 15 minutes
 * plus tard et effacé à 24 heures : Apple ou Google a délivré, ou non. Seul
 * l'un ou l'autre révèle `DeviceNotRegistered`, et c'est ce qui révoque un
 * appareil.
 */

/** Les formes d'`expo-server-sdk`, réduites à ce qu'on lit. */
export type PushTicket =
  | { status: 'ok'; id: string }
  | { status: 'error'; message: string; details?: { error?: string } };

export type PushReceipt =
  | { status: 'ok' }
  | { status: 'error'; message: string; details?: { error?: string } };

/**
 * Posé par `sender.ts` sur chaque message d'un lot dont la requête a échoué :
 * réseau, service indisponible, ou `UNAUTHORIZED` quand la sécurité renforcée
 * d'Expo attend un jeton qu'on n'a pas (D17).
 */
export const REQUEST_FAILED = 'RequestFailed';

/** L'appareil ne recevra plus rien : on cesse de lui écrire (D7). */
export const DEVICE_NOT_REGISTERED = 'DeviceNotRegistered';

export type SentTo = { tokenId: string };

export type TicketsReading = {
  /** Les tickets acceptés, à relire plus tard. */
  accepted: { ticketId: string; tokenId: string }[];
  /** Les appareils à révoquer tout de suite. */
  revoke: string[];
  /** Ce qui mérite d'apparaître au contrôle de santé. */
  errors: string[];
  /** Vrai quand aucune requête n'a abouti : Expo était injoignable. */
  unreachable: boolean;
};

function errorCode(answer: { message: string; details?: { error?: string } }): string {
  return answer.details?.error ?? 'Error';
}

function explain(answer: { message: string; details?: { error?: string } }): string {
  return `${errorCode(answer)} : ${answer.message}`.slice(0, 500);
}

/**
 * Les tickets, dans l'ordre des messages envoyés. Un ticket manquant compte
 * comme une erreur : Expo en rend un par message, ou rien n'est fiable.
 */
export function readTickets(sent: SentTo[], tickets: PushTicket[]): TicketsReading {
  const reading: TicketsReading = { accepted: [], revoke: [], errors: [], unreachable: false };
  let requestFailures = 0;

  sent.forEach((message, index) => {
    const ticket = tickets[index];
    if (!ticket) {
      reading.errors.push("MissingTicket : Expo n'a pas rendu de ticket pour ce message");
      return;
    }
    if (ticket.status === 'ok') {
      reading.accepted.push({ ticketId: ticket.id, tokenId: message.tokenId });
      return;
    }
    const code = errorCode(ticket);
    if (code === DEVICE_NOT_REGISTERED) {
      reading.revoke.push(message.tokenId);
    } else {
      if (code === REQUEST_FAILED) requestFailures += 1;
      reading.errors.push(explain(ticket));
    }
  });

  reading.unreachable = sent.length > 0 && requestFailures === sent.length;
  reading.errors = [...new Set(reading.errors)];
  return reading;
}

export type TicketToCheck = { ticketId: string; tokenId: string };

export type ReceiptsReading = {
  /** Les tickets dont l'accusé est arrivé, et ce qu'il dit. */
  checked: { ticketId: string; status: string }[];
  revoke: string[];
  errors: string[];
};

/**
 * Les accusés. Un ticket sans accusé n'est pas encore relu : Expo peut mettre
 * jusqu'à 30 minutes sous charge, on repassera au battement suivant.
 */
export function readReceipts(
  tickets: TicketToCheck[],
  receipts: Record<string, PushReceipt | undefined>,
): ReceiptsReading {
  const reading: ReceiptsReading = { checked: [], revoke: [], errors: [] };

  for (const ticket of tickets) {
    const receipt = receipts[ticket.ticketId];
    if (!receipt) continue;
    if (receipt.status === 'ok') {
      reading.checked.push({ ticketId: ticket.ticketId, status: 'ok' });
      continue;
    }
    const code = errorCode(receipt);
    reading.checked.push({ ticketId: ticket.ticketId, status: code });
    if (code === DEVICE_NOT_REGISTERED) {
      reading.revoke.push(ticket.tokenId);
    } else {
      reading.errors.push(explain(receipt));
    }
  }

  reading.revoke = [...new Set(reading.revoke)];
  reading.errors = [...new Set(reading.errors)];
  return reading;
}
