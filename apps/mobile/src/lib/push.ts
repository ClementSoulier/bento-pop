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

// ─── Lot 4 : ce qu'ouvre une notification ────────────────────────────────

/**
 * Où mène le tap d'une notification. Chantier 17, lot 4, §5.1, D21 et D22.
 *
 * `data` vient de dehors : on n'en garde que ce qu'on connaît, et un type, un
 * statut ou un identifiant inattendus ne mènent nulle part. Le back-office n'y
 * met que le type et des identifiants, jamais d'adresse (§6.5) : l'app
 * n'ouvre que des écrans qu'elle connaît.
 */
export type PushTarget =
  | {
      kind: 'item';
      status: 'validated' | 'merged' | 'rejected';
      itemId: string;
      /** Pour une fusion, l'item conservé : c'est lui qui remplit la case. */
      keptItemId: string | null;
    }
  | { kind: 'edition'; editionId: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODERATION_STATUSES = ['validated', 'merged', 'rejected'] as const;
/** `editions.id` est un `smallint`. */
const SMALLINT_MAX = 32767;

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

/** Un entier positif, ou sa forme en chiffres : un service de push peut tout rendre en texte. */
function positiveInt(value: unknown): number | null {
  const n = typeof value === 'string' && /^\d{1,5}$/.test(value) ? Number(value) : value;
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= SMALLINT_MAX ? n : null;
}

export function pushTargetFromData(data: unknown): PushTarget | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;

  if (d.type === 'item_moderated') {
    const status = MODERATION_STATUSES.find((s) => s === d.status);
    if (!status || !isUuid(d.itemId)) return null;
    return {
      kind: 'item',
      status,
      itemId: d.itemId,
      keptItemId: isUuid(d.keptItemId) ? d.keptItemId : null,
    };
  }

  if (d.type === 'edition_released') {
    const editionId = positiveInt(d.editionId);
    return editionId === null ? null : { kind: 'edition', editionId };
  }

  return null;
}

/** Une case d'un bento du compte, en base, où l'item est posé. */
export type ItemPlacement = { bentoId: string; categoryId: number; itemId: string };

/** Une case affichée par le composer, brouillon compris. */
export type ShownSlot = { caseKey: string; itemId: string };

export type ItemTargetPlan =
  /** L'item est dans le bento affiché : on reste, et on montre sa case. */
  | { where: 'shown'; caseKey: string; openSearch: boolean }
  /** L'item est dans un autre bento du compte : on bascule d'abord. */
  | { where: 'bento'; bentoId: string; categoryId: number; openSearch: boolean };

/**
 * Le bento et la case qu'ouvre la notification d'un item (D22).
 *
 * D'abord ce que le composer affiche : sans profil, on compose un brouillon
 * gardé sur le téléphone, qui n'existe pas en base avant la première
 * publication, et c'est le cas le plus courant chez qui propose un item.
 * Ensuite les bentos du compte en base : celui qu'on édite, puis le
 * principal, puis n'importe lequel.
 *
 * L'item conservé d'une fusion passe avant l'item proposé :
 * `admin_merge_items` a réécrit les cases vers lui. Un refus ouvre en plus la
 * recherche de la case, puisque le texte invite à choisir un autre item.
 *
 * Un refus que le brouillon a déjà retiré de sa case (D25) ne se retrouve
 * plus : `originCaseKey`, la case d'où venait la proposition, prend le relais.
 */
export function planItemTarget(
  target: Extract<PushTarget, { kind: 'item' }>,
  where: {
    shown: ShownSlot[];
    placements: ItemPlacement[];
    currentBentoId: string | null;
    primaryBentoId: string | null;
    /** La case d'origine de la proposition, dans le bento affiché, si on la connaît. */
    originCaseKey?: string | null;
  },
): ItemTargetPlan | null {
  const openSearch = target.status === 'rejected';
  const ids = target.keptItemId ? [target.keptItemId, target.itemId] : [target.itemId];

  for (const id of ids) {
    const slot = where.shown.find((s) => s.itemId === id);
    if (slot) return { where: 'shown', caseKey: slot.caseKey, openSearch };
  }

  for (const id of ids) {
    const found = where.placements.filter((p) => p.itemId === id);
    const pick =
      found.find((p) => p.bentoId === where.currentBentoId) ??
      found.find((p) => p.bentoId === where.primaryBentoId) ??
      found[0];
    if (pick) return { where: 'bento', bentoId: pick.bentoId, categoryId: pick.categoryId, openSearch };
  }

  if (openSearch && where.originCaseKey) {
    return { where: 'shown', caseKey: where.originCaseKey, openSearch };
  }
  return null;
}

// ─── Lot 4 : la section Notifications du profil ──────────────────────────

/** Les deux réglages de cet appareil, tels que la base les garde (D8). */
export type DeviceSettings = { transactional: boolean; editorial: boolean };

/** Android laisse couper un canal depuis ses propres réglages (§1.4). */
export type ChannelBlocks = { items: boolean; editions: boolean };

export type NotificationSection =
  /** Jamais demandée : « Activer les notifications ». */
  | { state: 'ask' }
  /** Refusée, le système ne demandera plus : « Ouvrir les réglages ». */
  | { state: 'blocked' }
  /** Accordée, mais l'appareil n'a pas pu s'enregistrer. */
  | { state: 'unavailable' }
  | {
      state: 'ready';
      items: { on: boolean; blockedBySystem: boolean };
      editions: { on: boolean; blockedBySystem: boolean };
    };

/**
 * Ce que montre la section (§5.4). Couper un type dans l'app ne retire pas
 * l'autorisation du système, et l'inverse non plus : l'écran dit lequel des
 * deux bloque, sinon on coupe sans comprendre pourquoi rien ne change.
 */
export function notificationSection(input: {
  permission: PushPermission;
  device: DeviceSettings | null;
  channels: ChannelBlocks;
}): NotificationSection {
  if (!input.permission.granted) {
    return { state: input.permission.canAskAgain ? 'ask' : 'blocked' };
  }
  if (!input.device) return { state: 'unavailable' };
  return {
    state: 'ready',
    items: { on: input.device.transactional, blockedBySystem: input.channels.items },
    editions: { on: input.device.editorial, blockedBySystem: input.channels.editions },
  };
}

// ─── Lot 4 : l'accord éditorial ──────────────────────────────────────────

/**
 * Proposer la phrase de l'accord éditorial (D20) ?
 *
 * Une seule fois par téléphone : après une réponse, oui comme non, seul
 * l'interrupteur du profil décide. Pas si « Les éditions » est déjà allumé.
 * Et pas si le système ne peut plus demander : le « Oui » n'ouvrirait rien.
 */
export function shouldOfferEditorialAsk(input: {
  permission: PushPermission;
  editorialOn: boolean;
  alreadyAnswered: boolean;
}): boolean {
  if (input.alreadyAnswered || input.editorialOn) return false;
  return input.permission.granted || input.permission.canAskAgain;
}

export const EDITORIAL_ASK_TITLE = 'On te prévient quand une édition sort ?';
export const EDITORIAL_ASK_MESSAGE = 'Une notification par semaine, le jeudi à 18 h.';
export const EDITORIAL_ASK_ACCEPT = 'Oui';
export const EDITORIAL_ASK_DECLINE = 'Non merci';
