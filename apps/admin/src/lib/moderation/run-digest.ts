import { composeDigest, shouldSendDigest, type AlertableReport } from './digest';
import type { Mailer } from './mailer';

/**
 * Le passage du battement pour la modération, chantier 22 (D11) : appelé à
 * chaque battement du chantier 17, toutes les 5 minutes, après la réponse de
 * `/api/push/tick` et à part du travail des push.
 *
 * Les dépendances sont injectées, comme `runTick` : testé sous `node:test`
 * contre de faux appels, branché sur la base par
 * `createSupabaseModerationStore`.
 */

export type ModerationStore = {
  /** Les signalements en attente dont aucun mail n'a encore prévenu l'équipe. */
  unalertedReports: () => Promise<AlertableReport[]>;
  /** Le dernier mail parti, d'après `reports.alerted_at`. */
  lastAlertAt: () => Promise<Date | null>;
  markAlerted: (ids: readonly string[], at: Date) => Promise<void>;
};

export type DigestOutcome =
  | { sent: number }
  | { skipped: 'nothing' | 'too-soon' | 'no-mailer' | 'no-recipients' };

export async function runModerationDigest({
  store,
  mailer,
  recipients,
  adminUrl,
  now,
}: {
  store: ModerationStore;
  mailer: Mailer | null;
  recipients: readonly string[];
  adminUrl: string;
  now: Date;
}): Promise<DigestOutcome> {
  const unalerted = await store.unalertedReports();
  if (unalerted.length === 0) return { skipped: 'nothing' };
  if (!shouldSendDigest({ unalerted, lastAlertAt: await store.lastAlertAt(), now })) {
    return { skipped: 'too-soon' };
  }
  // Sans transport ni destinataire, rien ne part et rien n'est marqué : le
  // mail partira avec la mise en service, tous ces signalements compris.
  if (!mailer) return { skipped: 'no-mailer' };
  if (recipients.length === 0) return { skipped: 'no-recipients' };

  const mail = composeDigest(unalerted, { adminUrl });
  await mailer.send({ to: recipients, ...mail });
  // Marqués après l'envoi seulement : un envoi perdu repart au battement
  // suivant plutôt que de taire un signalement.
  await store.markAlerted(
    unalerted.map((r) => r.id),
    now,
  );
  return { sent: unalerted.length };
}
