/**
 * Aligne le segment Resend de la newsletter sur la table des inscrits, juste
 * avant un envoi (docs/NEWSLETTER-ENVOI.md, D6). La table fait foi : la
 * landing crée et efface déjà les contacts au fil de l'eau, ceci rattrape un
 * appel perdu.
 */
import { ResendError, type ResendClient, type ResendContact } from './resend';

export type SyncPlan = {
  /** Inscrits absents du segment : à créer chez Resend. */
  create: string[];
  /** Contacts du segment qui ne sont plus inscrits : à effacer chez Resend. */
  remove: ResendContact[];
  /** Désinscrits chez Resend mais encore dans la table (webhook perdu) : à effacer partout. */
  erase: ResendContact[];
  /** Destinataires une fois le plan appliqué. */
  recipients: number;
};

const norm = (email: string) => email.trim().toLowerCase();

export function planSync(subscribers: readonly string[], contacts: readonly ResendContact[]): SyncPlan {
  const wanted = new Set(subscribers.map(norm));
  const known = new Map<string, ResendContact>();
  for (const c of contacts) known.set(norm(c.email), c);

  const erase = contacts.filter((c) => c.unsubscribed && wanted.has(norm(c.email)));
  const remove = contacts.filter((c) => !wanted.has(norm(c.email)));
  const create = [...wanted].filter((email) => !known.has(email));
  return { create, remove, erase, recipients: wanted.size - erase.length };
}

export type SyncResult = {
  recipients: number;
  created: number;
  removed: number;
  erased: number;
  failed: number;
};

type SyncDeps = {
  resend: ResendClient;
  segmentId: string;
  /** Les adresses de la table des inscrits. */
  subscribers: readonly string[];
  /** Efface des adresses de la table (désinscrites chez Resend). */
  eraseSubscribers: (emails: string[]) => Promise<void>;
  /**
   * Pause entre deux appels : l'API accepte 10 requêtes par seconde pour tout
   * le compte, codes de connexion de l'app compris. 250 ms laissent de la marge.
   */
  pauseMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function syncSegment(deps: SyncDeps): Promise<SyncResult> {
  const sleep = deps.sleep ?? defaultSleep;
  const pause = deps.pauseMs ?? 250;
  const { resend, segmentId } = deps;

  /** Un appel, retenté une fois après une seconde si Resend répond « trop vite » (429). */
  async function paced<T>(run: () => Promise<T>): Promise<T> {
    await sleep(pause);
    try {
      return await run();
    } catch (e) {
      if (e instanceof ResendError && e.status === 429) {
        await sleep(1000);
        return run();
      }
      throw e;
    }
  }

  const contacts = await resend.listSegmentContacts(segmentId);
  const plan = planSync(deps.subscribers, contacts);
  let created = 0;
  let removed = 0;
  let failed = 0;

  if (plan.erase.length > 0) {
    await deps.eraseSubscribers(plan.erase.map((c) => norm(c.email)));
  }
  for (const contact of [...plan.erase, ...plan.remove]) {
    try {
      await paced(() => resend.deleteContact(contact.id));
      removed++;
    } catch {
      // Un contact resté chez Resend mais hors de la table ne reçoit rien de
      // plus qu'avant ; il sera repris au prochain envoi.
    }
  }
  for (const email of plan.create) {
    try {
      await paced(() => resend.createContact(email, segmentId));
      created++;
    } catch (e) {
      // L'adresse existe déjà chez Resend, hors du segment : on l'y ajoute.
      if (e instanceof ResendError && e.status >= 400 && e.status < 500 && e.status !== 429) {
        try {
          await paced(() => resend.addContactToSegment(email, segmentId));
          created++;
          continue;
        } catch {
          // Compté ci-dessous.
        }
      }
      failed++;
    }
  }

  return { recipients: plan.recipients, created, removed, erased: plan.erase.length, failed };
}
