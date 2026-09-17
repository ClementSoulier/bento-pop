/**
 * Notifications push, la logique sans module natif. Chantier 17, lot 2.
 *
 * Tout ce qui décide vit ici et se teste en Node : faut-il proposer la
 * demande d'autorisation, faut-il réenregistrer l'appareil, que dire. Le
 * branchement sur `expo-notifications` et Supabase est dans
 * `push-runtime.ts`. Cf. `docs/UX-17-NOTIFICATIONS-PUSH.md`, §5.3.
 */

export type PushPlatform = 'ios' | 'android';

/** L'état de l'autorisation système, tel qu'`expo-notifications` le rend. */
export type PushPermission = {
  granted: boolean;
  /** Faux quand le système ne montrera plus jamais sa boîte. */
  canAskAgain: boolean;
};

/**
 * Proposer la phrase qui précède la boîte du système (D14) ?
 *
 * Seulement si l'autorisation manque et que le système peut encore la
 * demander. Après un refus, iOS ne montre plus jamais sa boîte : une phrase
 * dont le « Oui » n'ouvrirait rien serait pire que rien.
 */
export function shouldOfferPushAsk(permission: PushPermission): boolean {
  return !permission.granted && permission.canAskAgain;
}

/**
 * La phrase, qui nomme l'item plutôt que l'action (§5.1) : « Interstellar »
 * dit quelque chose, « ton item » presque rien.
 */
export function pushAskTitle(itemTitle: string): string {
  const title = itemTitle.trim();
  return title
    ? `On te prévient quand « ${title} » est validé ?`
    : 'On te prévient quand ton item est validé ?';
}

export const PUSH_ASK_MESSAGE =
  "L'équipe relit chaque proposition. Une notification te préviendra dès qu'elle aura répondu.";
export const PUSH_ASK_ACCEPT = 'Oui, préviens-moi';
export const PUSH_ASK_LATER = 'Plus tard';

/**
 * Un enregistrement récent n'a pas à être refait à chaque retour au premier
 * plan. Une heure suffit largement à tenir `last_seen_at`, dont la péremption
 * est de 60 jours (D7).
 */
export const PUSH_REFRESH_INTERVAL_MS = 60 * 60 * 1000;

/** Le dernier enregistrement réussi, gardé en mémoire le temps de la session. */
export type PushRegistrationMemory = {
  token: string;
  userId: string;
  at: number;
} | null;

export type PushRegistrationOutcome =
  | { state: 'skipped'; reason: 'no-session' | 'not-granted' | 'recent' }
  | { state: 'registered'; token: string }
  | { state: 'failed'; step: 'permission' | 'token' | 'register'; error: unknown };

export type PushRegistrationDeps = {
  platform: PushPlatform;
  /** Le compte connecté, anonyme compris, ou `null` sans session. */
  userId: () => string | null;
  permission: () => Promise<PushPermission>;
  expoToken: () => Promise<string>;
  register: (token: string, platform: PushPlatform) => Promise<void>;
  now: () => number;
};

/**
 * Une seule tentative à la fois.
 *
 * Accorder l'autorisation déclenche deux rafraîchissements presque ensemble :
 * celui qu'on demande juste après la boîte du système, et celui du retour au
 * premier plan, puisque la boîte l'avait fait quitter. Mesuré au simulateur et
 * à l'émulateur le 17 septembre 2026 : deux appels, deux fois le même travail.
 *
 * Un appel pendant une tentative en cours la partage. Un appel forcé la
 * partage aussi quand elle a enregistré l'appareil, et la refait sinon : la
 * tentative en cours a pu lire l'autorisation avant qu'elle soit accordée.
 */
export function coalescePushRefresh(
  run: (force: boolean) => Promise<PushRegistrationOutcome>,
): (force?: boolean) => Promise<PushRegistrationOutcome> {
  let inFlight: Promise<PushRegistrationOutcome> | null = null;

  const start = (force: boolean) => {
    const attempt = run(force).finally(() => {
      if (inFlight === attempt) inFlight = null;
    });
    inFlight = attempt;
    return attempt;
  };

  return async (force = false) => {
    if (inFlight) {
      const current = await inFlight;
      if (!force || current.state === 'registered') return current;
      if (inFlight) return inFlight;
    }
    return start(force);
  };
}

/**
 * Enregistre l'appareil si l'autorisation est accordée. **Ne demande jamais
 * rien** et ne lève jamais : un échec se lit dans le résultat, l'app continue
 * exactement pareil (§2, critère 7).
 *
 * Refait l'enregistrement quand le compte a changé depuis le dernier, même
 * récent : une session anonyme perdue recrée un compte sur le même appareil,
 * et le jeton doit le suivre.
 */
export async function refreshPushRegistration(
  deps: PushRegistrationDeps,
  memory: PushRegistrationMemory,
  options: { force?: boolean } = {},
): Promise<{ outcome: PushRegistrationOutcome; memory: PushRegistrationMemory }> {
  const userId = deps.userId();
  if (!userId) {
    return { outcome: { state: 'skipped', reason: 'no-session' }, memory };
  }

  let permission: PushPermission;
  try {
    permission = await deps.permission();
  } catch (error) {
    return { outcome: { state: 'failed', step: 'permission', error }, memory };
  }
  if (!permission.granted) {
    return { outcome: { state: 'skipped', reason: 'not-granted' }, memory };
  }

  const recent =
    memory !== null &&
    memory.userId === userId &&
    deps.now() - memory.at < PUSH_REFRESH_INTERVAL_MS;
  if (recent && !options.force) {
    return { outcome: { state: 'skipped', reason: 'recent' }, memory };
  }

  let token: string;
  try {
    token = await deps.expoToken();
  } catch (error) {
    return { outcome: { state: 'failed', step: 'token', error }, memory };
  }

  try {
    await deps.register(token, deps.platform);
  } catch (error) {
    return { outcome: { state: 'failed', step: 'register', error }, memory };
  }

  return {
    outcome: { state: 'registered', token },
    memory: { token, userId, at: deps.now() },
  };
}
