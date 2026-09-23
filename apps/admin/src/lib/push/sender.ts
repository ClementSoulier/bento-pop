import 'server-only';
import { Expo } from 'expo-server-sdk';
import type { PushMessage } from './content';
import type { PushSender } from './pipeline';
import { type PushReceipt, type PushTicket, REQUEST_FAILED } from './tickets';

/**
 * `PushSender` sur le SDK d'Expo, qui découpe par 100 messages et 1 000
 * accusés, compresse, limite à six requêtes simultanées et réessaie sur un
 * `429` (D1).
 *
 * Version 6.1.0 : la 7 exige Node 22, et le back-office tourne sous Node 20.
 *
 * `accessToken` : le jeton d'un utilisateur robot, exigé dès que la sécurité
 * renforcée d'Expo est activée (D17). Absent, les envois partent sans.
 */
export function createExpoSender(accessToken?: string): PushSender {
  const expo = new Expo(accessToken ? { accessToken } : {});

  return {
    async send(messages: PushMessage[]): Promise<PushTicket[]> {
      const tickets: PushTicket[] = [];
      // Un message par appareil, donc un ticket par message et dans l'ordre :
      // les lots se suivent sans se mélanger.
      for (const chunk of expo.chunkPushNotifications(messages)) {
        try {
          tickets.push(...(await expo.sendPushNotificationsAsync(chunk)));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          tickets.push(
            ...chunk.map((): PushTicket => ({ status: 'error', message, details: { error: REQUEST_FAILED } })),
          );
        }
      }
      return tickets;
    },

    async receipts(ticketIds: string[]): Promise<Record<string, PushReceipt>> {
      const receipts: Record<string, PushReceipt> = {};
      for (const chunk of expo.chunkPushNotificationReceiptIds(ticketIds)) {
        Object.assign(receipts, await expo.getPushNotificationReceiptsAsync(chunk));
      }
      return receipts;
    },
  };
}
