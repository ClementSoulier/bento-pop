import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { withTimeout } from './with-timeout';

/**
 * Le lancement, chantier 28 : D5 et D6 de `docs/UX-28-COMPTE-RECUPERABLE.md`.
 *
 * ─── Le défaut ────────────────────────────────────────────────────────────
 *
 * Le lancement d'avant demandait la session à `auth-js` avec 8 secondes de
 * patience, et concluait à un premier lancement s'il n'en avait pas reçu :
 * il créait alors un compte anonyme, dont la session prenait la place de
 * l'ancienne. Or au lancement le jeton d'accès a presque toujours expiré, et
 * son renouvellement réessaie jusqu'à 30 secondes sur un réseau faible
 * (§4.1). Reproduit par `boot-session.integration.test.ts` : un
 * renouvellement lent suffit à ouvrir l'app sur un compte neuf et vide.
 *
 * ─── La règle ─────────────────────────────────────────────────────────────
 *
 * **Un compte ne se crée que sur un appareil qui n'en a jamais eu** (D5).
 * L'appareil le sait par deux traces : la session que range `auth-js`, et la
 * marque que range l'app (`DeviceAccount`), que `auth-js` n'efface jamais.
 *
 *   - une session rendue à temps : on la prend ;
 *   - une session toujours rangée mais pas encore rendue : elle se renouvelle,
 *     ou le réseau manque. L'app s'ouvre comme hors ligne et le compte arrive
 *     plus tard par `onAuthStateChange` ; rien n'est créé ;
 *   - plus de session, mais la marque d'un compte : `auth-js` l'a effacée,
 *     son renouvellement refusé pour de bon. Un compte gardé se retrouve d'un
 *     code (D6) ; un anonyme est perdu, et un compte neuf le remplace ;
 *   - ni l'une ni l'autre : premier lancement, ou après une déconnexion
 *     voulue, qui efface la marque. Un compte anonyme neuf.
 *
 * Aucun import de `react-native` : testé sous `node:test`, contre un bouchon
 * de GoTrue et le vrai `supabase-js`.
 */

/** Ce que l'appareil sait du dernier compte ouvert, rangé par l'app. */
export type DeviceAccount = { userId: string; email: string | null };

export type BootOutcome =
  /** La session rangée, rendue à temps. */
  | { kind: 'session'; session: Session }
  /** Un compte anonyme neuf ; `replacing`, le compte anonyme perdu qu'il remplace. */
  | { kind: 'created'; session: Session; replacing: string | null }
  /** Une session rangée qui se renouvelle encore : rien n'est créé. */
  | { kind: 'pending'; userId: string | null }
  /** La session d'un compte gardé, refusée pour de bon : « Reconnecte-toi ». */
  | { kind: 'lost'; device: DeviceAccount & { email: string } }
  /** Aucun compte, et aucun moyen d'en créer un maintenant. */
  | { kind: 'offline' };

export type BootDeps = {
  auth: Pick<SupabaseClient['auth'], 'getSession' | 'signInAnonymously'>;
  /** La session rangée par `auth-js`, lue sans la renouveler, ou `null`. */
  readStoredSession: () => Promise<{ userId: string | null } | null>;
  /** La marque de l'app, ou `null`. */
  readDeviceAccount: () => Promise<DeviceAccount | null>;
  /** 8 secondes dans l'app : le rejet App Store 2bf822e0, `session.ts`. */
  timeoutMs: number;
};

export async function bootSession(deps: BootDeps): Promise<BootOutcome> {
  const device = await deps.readDeviceAccount().catch(() => null);

  const loaded = await withTimeout(
    deps.auth.getSession().then(({ data }) => data.session),
    deps.timeoutMs,
    null,
  );
  if (loaded) return { kind: 'session', session: loaded };

  // Lue après `getSession` et non avant : `auth-js` commence à renouveler la
  // session dès la création du client, et l'a peut-être déjà effacée. Encore
  // là, elle n'est pas perdue.
  const stored = await deps.readStoredSession().catch(() => null);
  if (stored) return { kind: 'pending', userId: stored.userId ?? device?.userId ?? null };

  if (device?.email) return { kind: 'lost', device: { ...device, email: device.email } };
  return createAnonymous(deps, device?.userId ?? null);
}

async function createAnonymous(deps: BootDeps, replacing: string | null): Promise<BootOutcome> {
  const created = await withTimeout(
    deps.auth.signInAnonymously().then(({ data, error }) => {
      if (error) throw error;
      return data.session;
    }),
    deps.timeoutMs,
    null,
  );
  return created ? { kind: 'created', session: created, replacing } : { kind: 'offline' };
}

/**
 * La clé sous laquelle `supabase-js` range la session, celle qu'il calcule
 * lui-même quand on ne lui en donne pas (`SupabaseClient.ts`, 2.105.4). La
 * donner explicitement ne change rien pour les sessions déjà rangées, et
 * permet de la lire sans passer par le client.
 */
export function authStorageKey(supabaseUrl: string): string {
  return `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
}

/** L'identifiant d'une session rangée, sans rien supposer de plus. */
export function parseStoredSession(raw: string | null): { userId: string | null } | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { user?: { id?: unknown } } | null;
    if (!value || typeof value !== 'object') return null;
    return { userId: typeof value.user?.id === 'string' ? value.user.id : null };
  } catch {
    return null;
  }
}

/** La marque de l'app, rangée sous `DEVICE_ACCOUNT_KEY`. */
export const DEVICE_ACCOUNT_KEY = 'bp_device_account';

export function parseDeviceAccount(raw: string | null): DeviceAccount | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<DeviceAccount> | null;
    if (!value || typeof value.userId !== 'string') return null;
    return { userId: value.userId, email: typeof value.email === 'string' ? value.email : null };
  } catch {
    return null;
  }
}

export function serializeDeviceAccount(account: DeviceAccount): string {
  return JSON.stringify({ userId: account.userId, email: account.email });
}
